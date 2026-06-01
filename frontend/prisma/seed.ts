import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.DATABASE_URL || "file:./prisma/dev.db";

  const libsql = createClient({ url });
  const prisma = new PrismaClient({ adapter: new PrismaLibSql(libsql as any) });

  const existing = await prisma.systemSetting.findUnique({
    where: { id: "default" },
  });

  if (!existing) {
    await prisma.systemSetting.create({
      data: {
        id: "default",
        apiKey: process.env.LLM_API_KEY || "",
        baseUrl: "https://api.deepseek.com",
        modelName: "deepseek-chat",
      },
    });
    console.log("Database seeded: default settings created");
  } else {
    console.log("Default settings already exist, skipping seed");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
