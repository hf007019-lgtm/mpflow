"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function toggleUserStatusAction(id: string) {
  const user = await db.execute({
    sql: "SELECT status FROM User WHERE id = ?",
    args: [id],
  });
  const row = user.rows[0] as unknown as { status: string } | undefined;
  const next = row?.status === "active" ? "suspended" : "active";
  await db.execute({ sql: "UPDATE User SET status = ? WHERE id = ?", args: [next, id] });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(id: string) {
  await db.execute({ sql: "DELETE FROM User WHERE id = ?", args: [id] });
  revalidatePath("/admin/users");
}

export async function adjustUserPoints(id: string, amount: number) {
  const current = await db.execute({
    sql: "SELECT pointsBalance FROM User WHERE id = ?",
    args: [id],
  });
  const row = current.rows[0] as unknown as { pointsBalance: number } | undefined;
  const newBalance = Math.max(0, (row?.pointsBalance || 0) + amount);
  await db.execute({
    sql: "UPDATE User SET pointsBalance = ? WHERE id = ?",
    args: [newBalance, id],
  });
  revalidatePath("/admin/users");
}

export async function saveLandingContent(data: {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrls: string[];
  features: { icon: string; title: string; desc: string }[];
}) {
  const { upsertLandingContent } = await import("@/lib/db");
  await upsertLandingContent(data);
  revalidatePath("/");
  revalidatePath("/admin/content");
}
