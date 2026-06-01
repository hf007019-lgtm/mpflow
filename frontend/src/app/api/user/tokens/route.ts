import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function GET(req: NextRequest) {
  const token = req.cookies.get("authjs.session-token")?.value;
  if (!token) {
    return NextResponse.json({ used: 0 });
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const userName = (payload.name || payload.email || "") as string;

    if (!userName) return NextResponse.json({ used: 0 });

    const { db } = await import("@/lib/db");
    const r = await db.execute({
      sql: "SELECT COALESCE(SUM(tokenUsed), 0) as total FROM GenerationLog WHERE userName = ?",
      args: [userName],
    });
    const row = r.rows[0] as unknown as { total: number };
    return NextResponse.json({ used: row?.total || 0 });
  } catch {
    return NextResponse.json({ used: 0 });
  }
}
