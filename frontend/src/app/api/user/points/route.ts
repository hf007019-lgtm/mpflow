import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getUserPoints, ensureUser, deductPoints } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

function extractAuth(req: NextRequest) {
  const token = req.cookies.get("authjs.session-token")?.value;
  if (!token) return null;
  return { token };
}

export async function GET(req: NextRequest) {
  const auth = extractAuth(req);
  if (!auth) {
    return NextResponse.json({ usedPoints: 0, pointsBalance: 0 });
  }

  try {
    const { payload } = await jwtVerify(auth.token, SECRET);
    const userName = (payload.name || payload.email || "") as string;
    const userEmail = (payload.email || "") as string;
    const userId = (payload.sub || "") as string;
    if (!userName && !userEmail) {
      return NextResponse.json({ usedPoints: 0, pointsBalance: 0 });
    }

    // Safety net: create user if they don't exist yet (e.g. auth callback DB sync failed silently)
    if (userEmail) {
      await ensureUser(userName, userEmail, userId);
    }

    const { db } = await import("@/lib/db");
    const r = await db.execute({
      sql: "SELECT COALESCE(SUM(pointsUsed), 0) as total FROM GenerationLog WHERE userName = ?",
      args: [userName],
    });
    const row = r.rows[0] as unknown as { total: number };
    const balance = await getUserPoints(userName, userEmail);
    return NextResponse.json({ usedPoints: row?.total || 0, pointsBalance: balance });
  } catch {
    return NextResponse.json({ usedPoints: 0, pointsBalance: 0 });
  }
}

// Server-side action → cost mapping. Only known actions are billable.
const ACTION_COSTS: Record<string, number> = {
  article_generate: 1,
};

export async function POST(req: NextRequest) {
  const auth = extractAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(auth.token, SECRET);
    const userName = (payload.name || payload.email || "") as string;
    const userEmail = (payload.email || "") as string;
    if (!userName && !userEmail) {
      return NextResponse.json({ error: "无效用户" }, { status: 401 });
    }

    const body = await req.json();
    const action = typeof body.action === "string" ? body.action.trim() : "";
    if (action === "article_generate") {
      const pointsBalance = await getUserPoints(userName, userEmail);
      return NextResponse.json({ pointsBalance, cost: 0, action });
    }

    const cost = ACTION_COSTS[action];
    if (!cost || !Number.isInteger(cost) || cost <= 0) {
      return NextResponse.json({ error: "无效的操作类型" }, { status: 400 });
    }

    const newBalance = await deductPoints(userName, cost, userEmail);
    return NextResponse.json({ pointsBalance: newBalance, cost, action });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "INSUFFICIENT_POINTS") {
      return NextResponse.json({ error: "积分不足" }, { status: 402 });
    }
    return NextResponse.json({ error: "扣费失败" }, { status: 500 });
  }
}
