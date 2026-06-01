import { NextRequest, NextResponse } from "next/server";
import { readLogs } from "@/lib/logger";

// Basic Auth check (reuse admin middleware logic inline)
function checkAuth(req: NextRequest) {
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

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }

  const logs = await readLogs(500);
  return new NextResponse(logs, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
