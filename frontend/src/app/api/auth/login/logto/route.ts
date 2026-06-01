import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";

export function GET(req: NextRequest) {
  const issuer = process.env.AUTH_LOGTO_ISSUER!;
  const clientId = process.env.AUTH_LOGTO_ID!;
  const redirectUri = `${process.env.AUTH_URL || "http://localhost:3000"}/api/auth/callback/logto`;
  const mode = req.nextUrl.searchParams.get("mode");

  const authUrl = new URL(`${issuer}/auth`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("interaction_mode", mode === "register" ? "signUp" : "signIn");

  const state = crypto.randomUUID();
  authUrl.searchParams.set("state", state);

  log("INFO", "auth:login", mode === "register" ? "Start signup" : "Start signin");
  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("logto_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}
