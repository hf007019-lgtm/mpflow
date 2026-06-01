import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const dbUrl = process.env.DATABASE_URL || `file:${path.join(process.cwd(), "dev.db")}`;

const libsql = createClient({ url: dbUrl });

export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter: new PrismaLibSql(libsql as any),
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
