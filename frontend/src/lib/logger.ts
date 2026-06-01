import { promises as fs } from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "data", "logs");

async function ensureDir() {
  try { await fs.mkdir(LOG_DIR, { recursive: true }); } catch { /* ok */ }
}

export function log(level: "INFO" | "WARN" | "ERROR", source: string, message: string, data?: unknown) {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  const extra = data ? ` | ${JSON.stringify(data)}` : "";
  const line = `[${ts}] [${level}] [${source}] ${message}${extra}\n`;

  // Console
  const fn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
  fn(`[${source}] ${message}`, data ?? "");

  // File (fire-and-forget)
  ensureDir().then(() => {
    const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFile(file, line).catch(() => {});
  });
}

/** Read recent log lines for admin inspection */
export async function readLogs(tail = 200) {
  try {
    await ensureDir();
    const files = await fs.readdir(LOG_DIR);
    const today = `${new Date().toISOString().slice(0, 10)}.log`;
    const target = files.includes(today)
      ? path.join(LOG_DIR, today)
      : path.join(LOG_DIR, files.sort().reverse()[0] || "unknown.log");

    try {
      const raw = await fs.readFile(target, "utf-8");
      const lines = raw.trim().split("\n");
      return lines.slice(-tail).join("\n");
    } catch {
      return "暂无日志";
    }
  } catch {
    return "日志读取失败";
  }
}
