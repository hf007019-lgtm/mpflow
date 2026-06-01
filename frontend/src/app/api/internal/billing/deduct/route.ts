import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { deductPoints, ensureUser } from "@/lib/db";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function POST(req: NextRequest) {
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  const providedToken = req.headers.get("x-internal-token");
  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionToken = req.cookies.get("authjs.session-token")?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const points = Number(body.points);
    if (!Number.isInteger(points) || points <= 0 || points > 100) {
      return NextResponse.json({ error: "Invalid points" }, { status: 400 });
    }

    const { payload } = await jwtVerify(sessionToken, SECRET);
    const userName = (payload.name || payload.email || "") as string;
    const userEmail = (payload.email || "") as string;
    const userId = (payload.sub || "") as string;
    if (!userName && !userEmail) {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    if (userEmail) {
      await ensureUser(userName, userEmail, userId);
    }

    const pointsBalance = await deductPoints(userName, points, userEmail);
    return NextResponse.json({ pointsBalance, cost: points });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "INSUFFICIENT_POINTS") {
      return NextResponse.json({ error: "Insufficient points" }, { status: 402 });
    }
    return NextResponse.json({ error: "Billing failed" }, { status: 500 });
  }
}
