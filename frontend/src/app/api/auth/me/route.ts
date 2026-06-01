import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function GET(req: NextRequest) {
  const token = req.cookies.get("authjs.session-token")?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return NextResponse.json({
      user: {
        name: payload.name,
        email: payload.email,
        image: payload.picture,
        id: payload.sub,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
