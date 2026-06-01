import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("authjs.session-token", "", { maxAge: 0, path: "/" });
  res.cookies.set("logto_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}

export async function GET() {
  const issuer = process.env.AUTH_LOGTO_ISSUER!;
  const clientId = process.env.AUTH_LOGTO_ID!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mpflowapp.com";
  const logoutUrl = `${issuer}/session/end?client_id=${encodeURIComponent(clientId)}&post_logout_redirect_uri=${encodeURIComponent(appUrl)}`;
  const res = NextResponse.redirect(logoutUrl);
  res.cookies.set("authjs.session-token", "", { maxAge: 0, path: "/" });
  res.cookies.set("logto_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
