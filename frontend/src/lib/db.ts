import { createClient, type Client } from "@libsql/client";
import path from "path";

/* ───── singleton — prevents connection sprawl in dev ───── */
const globalForDb = globalThis as unknown as { db: Client };

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return `file:${path.join(process.cwd(), "dev.db")}`;
}

export const db: Client =
  globalForDb.db || createClient({ url: getDbUrl() });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

/* ───── typed helpers ───── */

export interface UserRow {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  // Legacy token fields (unused, kept for compatibility)
  tokenUsed: number;
  tokenBalance: number;
  initialTokens: number;
  // Points-based billing
  pointsUsed: number;
  pointsBalance: number;
  initialPoints: number;
}

export async function getUsers(): Promise<UserRow[]> {
  const r = await db.execute(
    `SELECT u.id, u.name, u.email, u.status, u.createdAt,
            COALESCE(SUM(g.tokenUsed), 0) AS tokenUsed,
            COALESCE(SUM(g.pointsUsed), 0) AS pointsUsed,
            u.tokenBalance, u.initialTokens,
            u.pointsBalance, u.initialPoints
     FROM User u
     LEFT JOIN GenerationLog g ON g.userName = u.name
     GROUP BY u.id
     ORDER BY u.createdAt DESC`,
  );
  return r.rows as unknown as UserRow[];
}

export async function toggleUserStatus(id: string) {
  const user = await db.execute({
    sql: "SELECT status FROM User WHERE id = ?",
    args: [id],
  });
  const current = (user.rows[0] as unknown as { status: string })?.status;
  const next = current === "active" ? "suspended" : "active";
  await db.execute({ sql: "UPDATE User SET status = ? WHERE id = ?", args: [next, id] });
}

export async function deleteUser(id: string) {
  await db.execute({ sql: "DELETE FROM User WHERE id = ?", args: [id] });
}

export interface LogRow {
  id: string;
  topic: string;
  wordCount: number;
  tokenUsed: number;
  pointsUsed: number;
  duration: string;
  model: string;
  status: string;
  createdAt: string;
  userName: string;
}

export async function getLogs(): Promise<LogRow[]> {
  const r = await db.execute(
    "SELECT id, topic, wordCount, tokenUsed, COALESCE(pointsUsed, 0) AS pointsUsed, duration, model, status, createdAt, userName FROM GenerationLog ORDER BY createdAt DESC LIMIT 50",
  );
  return r.rows as unknown as LogRow[];
}

export async function createLog(data: {
  id: string;
  topic: string;
  wordCount: number;
  tokenUsed: number;
  pointsUsed: number;
  duration: string;
  model: string;
  status: string;
  userName: string;
}) {
  await db.execute({
    sql: `INSERT INTO GenerationLog (id, topic, wordCount, tokenUsed, pointsUsed, duration, model, status, createdAt, userName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [data.id, data.topic, data.wordCount, data.tokenUsed, data.pointsUsed, data.duration, data.model, data.status, new Date().toISOString(), data.userName],
  });
}

/* ───── Points billing ───── */

function normalizeEmail(email: string | undefined | null): string {
  return (email || "").trim().toLowerCase();
}

export async function ensureUser(name: string, email: string, id?: string): Promise<void> {
  try {
    const normalized = normalizeEmail(email);
    const existing = await db.execute({
      sql: "SELECT id, pointsBalance FROM User WHERE LOWER(email) = ?",
      args: [normalized],
    });
    if (existing.rows.length > 0) {
      // User exists — legacy recovery for genuinely NULL balance
      const row = existing.rows[0] as unknown as { id: string; pointsBalance: number | null };
      if (row.pointsBalance === null) {
        await db.execute({
          sql: "UPDATE User SET pointsBalance = 100 WHERE id = ? AND pointsBalance IS NULL",
          args: [row.id],
        });
      }
      return;
    }
    // Check by name as fallback
    const byName = await db.execute({
      sql: "SELECT id FROM User WHERE name = ?",
      args: [name],
    });
    if (byName.rows.length > 0) return;

    // Create user with 100 initial points
    await db.execute({
      sql: "INSERT INTO User (id, name, email, status, createdAt, pointsBalance, initialPoints) VALUES (?, ?, ?, 'active', ?, 100, 100)",
      args: [id || crypto.randomUUID(), name, normalized, new Date().toISOString()],
    });
  } catch (e) {
    console.error("[ensureUser] 创建用户失败:", name, email, e instanceof Error ? e.message : e);
  }
}

export async function getUserPoints(userName: string, email?: string): Promise<number> {
  // Email-first lookup: email is the stable key used by auth callbacks
  if (email) {
    const normalized = normalizeEmail(email);
    const r = await db.execute({
      sql: "SELECT pointsBalance FROM User WHERE LOWER(email) = ?",
      args: [normalized],
    });
    if (r.rows.length > 0) {
      const row = r.rows[0] as unknown as { pointsBalance: number };
      return row.pointsBalance ?? 0;
    }
  }
  // Fallback to name lookup
  const r = await db.execute({
    sql: "SELECT pointsBalance FROM User WHERE name = ?",
    args: [userName],
  });
  const row = r.rows[0] as unknown as { pointsBalance: number } | undefined;
  return row?.pointsBalance ?? 0;
}

export async function deductPoints(userName: string, points: number, email?: string): Promise<number> {
  // Step 1: Look up user by normalized email (preferred) or name — get the stable id
  const normalizedEmail = normalizeEmail(email);
  let userId: string | null = null;
  let balance: number | null = null;

  if (normalizedEmail) {
    const r = await db.execute({
      sql: "SELECT id, pointsBalance FROM User WHERE LOWER(email) = ?",
      args: [normalizedEmail],
    });
    if (r.rows.length > 0) {
      const row = r.rows[0] as unknown as { id: string; pointsBalance: number | null };
      userId = row.id;
      balance = row.pointsBalance;
    }
  }

  if (!userId) {
    const r = await db.execute({
      sql: "SELECT id, pointsBalance FROM User WHERE name = ?",
      args: [userName],
    });
    if (r.rows.length > 0) {
      const row = r.rows[0] as unknown as { id: string; pointsBalance: number | null };
      userId = row.id;
      balance = row.pointsBalance;
    }
  }

  if (!userId) {
    userId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO User (id, name, email, status, createdAt, pointsBalance, initialPoints) VALUES (?, ?, ?, 'active', ?, 100, 100)",
      args: [userId, userName, normalizedEmail || `${userName}@mpflowapp.com`, new Date().toISOString()],
    });
    balance = 100;
  }

  // Step 2: NULL recovery — only recover genuinely missing data, never 0
  if (balance === null) {
    await db.execute({
      sql: "UPDATE User SET pointsBalance = 100 WHERE id = ? AND pointsBalance IS NULL",
      args: [userId],
    });
    balance = 100;
  }

  // Step 3: Atomic deduction by id (stable primary key)
  const r = await db.execute({
    sql: "UPDATE User SET pointsBalance = pointsBalance - ? WHERE id = ? AND pointsBalance >= ?",
    args: [points, userId, points],
  });

  if (r.rowsAffected === 0) {
    throw new Error("INSUFFICIENT_POINTS");
  }

  // Step 4: Return new balance
  const result = await db.execute({
    sql: "SELECT pointsBalance FROM User WHERE id = ?",
    args: [userId],
  });
  const row = result.rows[0] as unknown as { pointsBalance: number };
  return row?.pointsBalance ?? 0;
}

/* ───── Landing Content ───── */

export interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

export interface LandingContentRow {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrls: string; // JSON array string
  features: string;
}

const defaultFeatures: FeatureItem[] = [
  { icon: "Gauge", title: "精准控字", desc: "500 到 5,000 字自由调节，长短随心，拒绝废话连篇。" },
  { icon: "ImageIcon", title: "自动配图", desc: "AI 自动搜索匹配文章段落的高质量图片，告别手动找图的痛苦。" },
  { icon: "MessageSquare", title: "深度引导", desc: "额外指令框支持补充写作要求，AI 精准理解你的风格偏好与叙事角度。" },
];

export async function getLandingContent(): Promise<{
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrls: string[];
  features: FeatureItem[];
}> {
  try {
    const r = await db.execute(
      "SELECT heroTitle, heroSubtitle, heroImageUrls, features FROM LandingContent WHERE id = 'default'",
    );
    const row = r.rows[0] as unknown as LandingContentRow | undefined;
    if (row) {
      let features: FeatureItem[] = defaultFeatures;
      try {
        const parsed = JSON.parse(row.features || "[]");
        if (Array.isArray(parsed) && parsed.length > 0) features = parsed;
      } catch { /* default */ }

      let heroImageUrls: string[] = [];
      try {
        const parsed = JSON.parse(row.heroImageUrls || "[]");
        if (Array.isArray(parsed)) heroImageUrls = parsed.filter(Boolean);
      } catch { /* default */ }

      return {
        heroTitle: row.heroTitle || "纯粹的灵感，\n优雅的表达。",
        heroSubtitle: row.heroSubtitle || "MPFlow 是专为公众号创作者打造的智能写作助手。",
        heroImageUrls,
        features,
      };
    }
  } catch { /* fallback */ }

  return {
    heroTitle: "纯粹的灵感，\n优雅的表达。",
    heroSubtitle: "MPFlow 是专为公众号创作者打造的智能写作助手。",
    heroImageUrls: [],
    features: defaultFeatures,
  };
}

/* ───── Dashboard Stats ───── */

export interface DashboardStats {
  totalUsers: number;
  todayGenerations: number;
  totalPointsConsumed: number;
  monthlyPointsConsumed: number;
  chartData: { day: string; calls: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const userCount = await db.execute("SELECT COUNT(*) as count FROM User");
  const totalUsers = Number((userCount.rows[0] as unknown as { count: number }).count);

  const todayCount = await db.execute({
    sql: "SELECT COUNT(*) as count FROM GenerationLog WHERE createdAt >= ?",
    args: [todayStart],
  });
  const todayGenerations = Number((todayCount.rows[0] as unknown as { count: number }).count);

  const totalPoints = await db.execute("SELECT COALESCE(SUM(pointsUsed), 0) as total FROM GenerationLog");
  const totalPointsConsumed = Number((totalPoints.rows[0] as unknown as { total: number }).total);

  const monthPoints = await db.execute({
    sql: "SELECT COALESCE(SUM(pointsUsed), 0) as total FROM GenerationLog WHERE createdAt >= ?",
    args: [monthStart],
  });
  const monthlyPointsConsumed = Number((monthPoints.rows[0] as unknown as { total: number }).total);

  // Chart: last 30 days grouped by day
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const chartRows = await db.execute({
    sql: `SELECT DATE(createdAt) as day, COUNT(*) as calls
          FROM GenerationLog
          WHERE createdAt >= ?
          GROUP BY DATE(createdAt)
          ORDER BY day ASC`,
    args: [thirtyDaysAgo],
  });

  const chartData: { day: string; calls: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = `${d.getMonth() + 1}/${d.getDate()}`;
    chartData.push({ day: dayStr, calls: 0 });
  }

  for (const row of chartRows.rows as unknown as { day: string; calls: number }[]) {
    const d = new Date(row.day + "T00:00:00");
    const dayStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const found = chartData.find((c) => c.day === dayStr);
    if (found) found.calls = Number(row.calls);
  }

  return { totalUsers, todayGenerations, totalPointsConsumed, monthlyPointsConsumed, chartData };
}

export async function upsertLandingContent(data: {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrls: string[];
  features: FeatureItem[];
}) {
  await db.execute({
    sql: `INSERT INTO LandingContent (id, heroTitle, heroSubtitle, heroImageUrls, features, updatedAt)
          VALUES ('default', ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            heroTitle = excluded.heroTitle,
            heroSubtitle = excluded.heroSubtitle,
            heroImageUrls = excluded.heroImageUrls,
            features = excluded.features,
            updatedAt = excluded.updatedAt`,
    args: [
      data.heroTitle,
      data.heroSubtitle,
      JSON.stringify(data.heroImageUrls),
      JSON.stringify(data.features),
      new Date().toISOString(),
    ],
  });
}
