export interface GenerateRequest {
  topic: string;
  language?: string;
  word_count?: number;
  with_images?: boolean;
  image_descriptions?: boolean;
  additional_instructions?: string;
  userName?: string;
}

export interface GenerateResponse {
  markdown: string;
  search_summary: string;
  image_count: number;
}

export interface ImageGenerateRequest {
  prompt: string;
  count: number;
}

export interface ImageGenerateResponse {
  images: { url?: string; error?: string }[];
}

const API_BASE = "";

/* ───── DALL-E image generation ───── */
export async function generateImages(req: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(`${API_BASE}/api/generate-image`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "图片生成失败");
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/* ───── non-streaming (legacy) ───── */
export async function generateArticle(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "请求失败，请稍后重试");
    }
    return res.json();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("请求超时，请稍后重试");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/* ───── streaming generator ───── */
export async function* generateArticleStream(req: GenerateRequest, signal?: AbortSignal) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "请求失败，请稍后重试");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.content) {
          yield parsed.content;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message !== "Unexpected token") {
          throw err;
        }
      }
    }
  }
}
