/* ───── AI 配图提示词生成 ───── */

export type PromptStyle =
  | "cinematic"    // 电影级写实
  | "anime"        // 新海诚动画风
  | "minimal"      // 极简摄影
  | "3d"           // 3D 渲染
  | "watercolor";  // 水彩插画

export const STYLE_LABELS: Record<PromptStyle, string> = {
  cinematic: "电影级写实",
  anime: "新海诚动画风",
  minimal: "极简摄影",
  "3d": "3D 渲染",
  watercolor: "水彩插画",
};

export async function generateImagePrompt(
  text: string,
  style: PromptStyle = "cinematic",
): Promise<string> {
  const styleHints: Record<PromptStyle, string> = {
    cinematic: "cinematic lighting, 8K, photorealistic, shallow depth of field, film grain",
    anime: "Makoto Shinkai style, anime, vibrant sky, lens flare, emotional atmosphere",
    minimal: "minimalist photography, clean composition, negative space, soft natural light",
    "3d": "3D render, octane render, global illumination, soft shadows, tactile texture",
    watercolor: "watercolor painting, soft brushstrokes, pastel tones, dreamy atmosphere",
  };

  const res = await fetch("/api/generate/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: `You are a professional Midjourney prompt engineer. Create a detailed image prompt in English based on the given Chinese text. Include: main subject, environment/scene, lighting, mood, and technical keywords. Add "${styleHints[style]}" at the end. Output ONLY the raw prompt, no quotes, no explanation. Maximum 200 characters.`,
      user: text.slice(0, 500),
    }),
  });

  if (!res.ok) throw new Error("生成失败");
  const data = await res.json();
  return data.result || "";
}
