import NextAuth from "next-auth";

const issuer = process.env.AUTH_LOGTO_ISSUER!;

const { handlers, auth, signIn, signOut } = NextAuth({
  debug: true,
  providers: [
    {
      id: "logto",
      name: "Logto",
      type: "oidc",
      clientId: process.env.AUTH_LOGTO_ID!,
      clientSecret: process.env.AUTH_LOGTO_SECRET!,
      issuer,
      authorization: `${issuer}/auth`,
      token: `${issuer}/token`,
      userinfo: `${issuer}/me`,
      checks: ["pkce", "state"],
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.username,
          email: profile.email,
          image: profile.picture ?? profile.avatar,
        };
      },
    },
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "logto") {
        try {
          const { db } = await import("@/lib/db");
          const email = user.email || `${user.id}@mpflowapp.com`;
          const name = user.name || (user.email ? user.email.split("@")[0] : "用户");
          const existing = await db.execute({
            sql: "SELECT id FROM User WHERE email = ?",
            args: [email],
          });
          if (existing.rows.length === 0) {
            await db.execute({
              sql: "INSERT INTO User (id, name, email, status, createdAt, pointsBalance, initialPoints) VALUES (?, ?, ?, 'active', ?, ?, ?)",
              args: [user.id || crypto.randomUUID(), name, email, new Date().toISOString(), 100, 100],
            });
          } else {
            // Legacy recovery: only for users with genuinely NULL balance
            const bal = await db.execute({
              sql: "SELECT pointsBalance FROM User WHERE email = ?",
              args: [email],
            });
            const br = bal.rows[0] as unknown as { pointsBalance: number | null } | undefined;
            if (br?.pointsBalance === null) {
              await db.execute({
                sql: "UPDATE User SET pointsBalance = 100 WHERE email = ? AND pointsBalance IS NULL",
                args: [email],
              });
            }
          }
        } catch (error) {
            console.error("[NextAuth signIn] 数据库同步失败:", error instanceof Error ? error.message : error);
          }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

export const { GET, POST } = handlers;
