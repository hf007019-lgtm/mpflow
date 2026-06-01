import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export async function GET() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(raw);
    return NextResponse.json({
      price_base_500_words: settings.price_base_500_words ?? 1,
      price_auto_image: settings.price_auto_image ?? 5,
      price_image_desc: settings.price_image_desc ?? 1,
      price_ai_image: settings.price_ai_image ?? 20,
    });
  } catch {
    return NextResponse.json({
      price_base_500_words: 1,
      price_auto_image: 5,
      price_image_desc: 1,
      price_ai_image: 20,
    });
  }
}
