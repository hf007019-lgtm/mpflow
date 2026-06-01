import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ detail: "Disabled" }, { status: 403 });
}
