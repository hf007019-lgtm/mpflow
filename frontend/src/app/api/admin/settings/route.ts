import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/* ───── shared config file path ───── */
const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");
const ENV_FILE = path.join(process.cwd(), ".env.local");

/* ───── helpers ───── */
function parseBasicAuth(req: NextRequest) {
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  if (!ADMIN_USER || !ADMIN_PASS) return false;

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const encoded = authHeader.split(" ")[1];
  if (!encoded) return false;

  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const [user, pass] = decoded.split(":");
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { apiBaseUrl: "", apiKey: "", model: "deepseek-chat" };
  }
}

async function writeSettings(data: Record<string, string>) {
  // Ensure data directory exists
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

/* ───── GET — return settings (NEVER expose apiKey) ───── */
export async function GET(req: NextRequest) {
  if (!parseBasicAuth(req)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="MPFlow Admin"',
      },
    });
  }

  const settings = await readSettings();
  return NextResponse.json({
    apiBaseUrl: settings.apiBaseUrl || "",
    model: settings.model || "deepseek-chat",
    multiplier: settings.multiplier || 1.0,
    price_base_500_words: settings.price_base_500_words ?? 1,
    price_auto_image: settings.price_auto_image ?? 5,
    price_image_desc: settings.price_image_desc ?? 1,
    // apiKey is intentionally omitted — never sent to client
  });
}

/* ───── POST — save settings ───── */
export async function POST(req: NextRequest) {
  if (!parseBasicAuth(req)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="MPFlow Admin"',
      },
    });
  }

  try {
    const body = await req.json();
    const { apiBaseUrl, apiKey, model, multiplier, price_base_500_words, price_auto_image, price_image_desc } = body;

    const settings = await readSettings();

    // Only update fields that were provided
    if (apiBaseUrl !== undefined) settings.apiBaseUrl = String(apiBaseUrl).trim();
    if (model !== undefined) settings.model = String(model).trim();
    if (multiplier !== undefined) settings.multiplier = Math.max(0.1, parseFloat(multiplier) || 1.0);
    if (price_base_500_words !== undefined) settings.price_base_500_words = Math.max(0, parseInt(price_base_500_words) || 0);
    if (price_auto_image !== undefined) settings.price_auto_image = Math.max(0, parseInt(price_auto_image) || 0);
    if (price_image_desc !== undefined) settings.price_image_desc = Math.max(0, parseInt(price_image_desc) || 0);

    // API key → .env.local (never stored in settings.json)
    if (apiKey !== undefined && apiKey.trim() !== "") {
      const key = String(apiKey).trim();
      try {
        let envContent = await fs.readFile(ENV_FILE, "utf-8");
        if (/^LLM_API_KEY=/m.test(envContent)) {
          envContent = envContent.replace(/^LLM_API_KEY=.*$/m, `LLM_API_KEY=${key}`);
        } else {
          envContent = envContent.trimEnd() + `\n\nLLM_API_KEY=${key}\n`;
        }
        await fs.writeFile(ENV_FILE, envContent, "utf-8");
      } catch {
        // .env.local doesn't exist yet, create it
        await fs.writeFile(ENV_FILE, `LLM_API_KEY=${key}\n`, "utf-8");
      }
    }

    // Don't persist apiKey in settings.json
    delete settings.apiKey;
    await writeSettings(settings);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "保存失败，请检查请求数据" },
      { status: 400 },
    );
  }
}
