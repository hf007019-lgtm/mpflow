import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { log } from "@/lib/logger";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

function redirectWithStateClear(path: string, baseUrl: string) {
  const res = NextResponse.redirect(new URL(path, baseUrl));
  res.cookies.set("logto_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const returnedState = searchParams.get("state");
  const expectedState = req.cookies.get("logto_oauth_state")?.value;

  log("INFO", "auth:callback", "Received callback", { hasCode: !!code, error: error || null });

  if (error || !code) {
    return redirectWithStateClear("/?error=login_failed", baseUrl);
  }

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    log("WARN", "auth:callback", "OAuth state mismatch");
    return redirectWithStateClear("/?error=invalid_state", baseUrl);
  }

  const issuer = process.env.AUTH_LOGTO_ISSUER!;
  const clientId = process.env.AUTH_LOGTO_ID!;
  const clientSecret = process.env.AUTH_LOGTO_SECRET!;
  const redirectUri = `${process.env.AUTH_URL || "http://localhost:3000"}/api/auth/callback/logto`;

  try {
    const tokenRes = await fetch(`${issuer}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      log("ERROR", "auth:callback", "Token exchange failed", {
        status: tokenRes.status,
        body: errText.slice(0, 300),
      });
      return redirectWithStateClear("/?error=token_exchange_failed", baseUrl);
    }

    const tokens = await tokenRes.json();

    let user: {
      sub: string;
      name?: string;
      email?: string;
      picture?: string;
      username?: string;
    } = { sub: "" };

    if (tokens.access_token) {
      const userRes = await fetch(`${issuer}/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userRes.ok) user = await userRes.json();
    }

    const email = user.email || `${user.sub}@mpflowapp.com`;
    const name = user.name || user.username || (user.email ? user.email.split("@")[0] : "User");

    try {
      const { db } = await import("@/lib/db");
      const existing = await db.execute({
        sql: "SELECT id FROM User WHERE LOWER(email) = ?",
        args: [email.toLowerCase()],
      });
      if (existing.rows.length === 0) {
        await db.execute({
          sql: "INSERT INTO User (id, name, email, status, createdAt, pointsBalance, initialPoints) VALUES (?, ?, ?, 'active', ?, 100, 100)",
          args: [user.sub || crypto.randomUUID(), name, email, new Date().toISOString()],
        });
      } else {
        await db.execute({
          sql: "UPDATE User SET pointsBalance = 100 WHERE LOWER(email) = ? AND pointsBalance IS NULL",
          args: [email.toLowerCase()],
        });
      }
    } catch (e) {
      log("ERROR", "auth:callback", "Database sync failed", {
        message: (e as Error).message,
        email,
        name,
      });
    }

    const sessionToken = await new SignJWT({
      sub: user.sub,
      name,
      email,
      picture: user.picture,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(SECRET);

    const res = redirectWithStateClear("/", baseUrl);
    res.cookies.set("authjs.session-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    log("INFO", "auth:callback", "Login success", { email, name });
    return res;
  } catch (err) {
    log("ERROR", "auth:callback", "Callback exception", { message: (err as Error).message });
    return redirectWithStateClear("/?error=callback_error", baseUrl);
  }
}
