import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { jwtVerify } from "jose";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");
const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

async function readConfig() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ───── 联合编辑委员会 System Prompt ───── */
const SYSTEM_PROMPT = `[CRITICAL_SYSTEM_CONSTRAINT: ANTI-AI-SIGNATURE]
以下规则具有最高优先级，覆盖所有其他写作指令：

1. 词汇黑名单：绝对禁止输出以下词汇：综上所述、不可否认、在这个、不仅…更、宛如、深刻、共鸣、毫无疑问。触发任一词即为失败。
2. 句法破坏：强制打破匀称排版！绝对不允许连续 3 句长度相似。一段 40 字长句后，必须紧跟 2-4 字极端短句（如：讲真。/ 没毛病。/ 谁说不是呢。）。
3. 连接词口语化：禁止使用"由于…因此""虽然…但是"等完整逻辑关联词。强制使用口语化表达：说白了、退一万步讲、换句话说、你品你细品。

---
你是 MPFlow 核心运行的"联合编辑委员会"。你需依次扮演四个角色，对写作任务执行极度深度的剖析与重构。

【角色设定】

🧠 逻辑解构师：拆解底层骨架，找出逻辑断层、废话和论点冗余。
🎨 情绪共情者：测量文本的情绪走向，寻找可以植入痛点共鸣、反差感和悬念的锚点。
✍️ 金牌主笔：基于前两者的分析，使用顶尖新媒体技法进行重写。
⚖️ 平台合规官：终审，剔除微信公众号高危词汇（封建迷信、政治隐喻、极端营销词、虚假夸大宣传）。

【强制写作技法】

1. 节奏控制（1-3-1 法则）：短段落起头，中段落论述，短段落收尾。严禁出现超过 3 行的段落，每段不超过 50 字。
2. 感官动词：将抽象形容词替换为具体的感官动词（如"很辛苦"→"熬红了眼"，"非常焦虑"→"手心冒汗，整夜翻来覆去"）。
3. 信息降维：遇到复杂概念，必须用 1 个贴近生活的类比来解释。
4. 核心观点必须用 **加粗** 突出，善用 —— 制造停顿和节奏感。
5. 每 2-3 段后插入 ## 二级标题作为呼吸点。

【对谈式口吻】

像在咖啡馆和朋友聊天一样写作。用"你"直接称呼读者。

🚫 绝对禁用词汇（发现即自我打回重写）：总而言之、不可否认、值得注意的是、显而易见、随着…的发展、在当今社会、综上所述。

【自我对抗】

完成初稿后，在内心用合规官和逻辑师视角挑刺。如果发现禁用词或逻辑断层，立即重写。

【输出规则】

- 正文前绝对不要写标题。
- 最终结尾必须是一句有记忆点的金句，让读者忍不住划线、截图、转发。
- 只输出最终润色好的文章正文，不要输出任何分析过程、JSON 或额外说明。`;

/* ───── English keyword translation ( quick LLM call ) ───── */
async function translateToEnglishKeywords(
  topic: string,
  config: { apiBaseUrl: string; apiKey: string; model: string },
): Promise<string> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "Translate the given topic into 2-4 concise English keywords for image search. Output ONLY the keywords, no punctuation, no explanation.",
          },
          { role: "user", content: topic },
        ],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}

/* ───── Unsplash image search ───── */
async function searchUnsplash(query: string): Promise<string> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !query) return "";

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!res.ok) return "";

    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return "";

    return photo.urls?.regular || photo.urls?.small || "";
  } catch {
    return "";
  }
}

/* ───── POST /api/generate ───── */
export async function POST(req: NextRequest) {
  // 1. Read config
  const config = (await readConfig()) || {};
  const apiKey = process.env.LLM_API_KEY || config.apiKey;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ detail: "请先在后台配置 API 密钥" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ detail: "无效的请求数据" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const topic = String(body.topic || "").slice(0, 500);
  const wordCount = Math.min(Math.max(Number(body.word_count) || 1500, 500), 5000);
  const extraPrompt = String(body.additional_instructions || "").slice(0, 500);
  const withImages = body.with_images !== false;
  const imageDescriptions = body.image_descriptions === true;

  if (!topic || topic.length < 2) {
    return new Response(
      JSON.stringify({ detail: "文章主题不能为空" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ───── Points billing: read dynamic pricing from config, then calculate ─────
  const priceBase = config.price_base_500_words ?? 1;
  const priceImage = config.price_auto_image ?? 5;
  const priceDesc = config.price_image_desc ?? 1;
  const pointsCost = Math.ceil(wordCount / 500) * priceBase + (withImages ? priceImage : 0) + (imageDescriptions ? priceDesc : 0);

  let userName = "匿名用户";
  let userEmail = "";
  try {
    const token = req.cookies.get("authjs.session-token")?.value;
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      userName = (payload.name || payload.email || "匿名用户") as string;
      userEmail = (payload.email || "") as string;
    }
  } catch { /* unauthenticated — use default */ }

  try {
    const { getUserPoints } = await import("@/lib/db");
    const balance = await getUserPoints(userName, userEmail);
    if (balance < pointsCost) {
      return new Response(
        JSON.stringify({ detail: `积分不足：需要 ${pointsCost} 积分，当前余额 ${balance} 积分` }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "INSUFFICIENT_POINTS") {
      return new Response(
        JSON.stringify({ detail: "积分不足，请充值后重试" }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }
    throw e;
  }

  console.log("[积分] 用户:", userName, "扣费:", pointsCost, "字数:", wordCount, "配图:", withImages, "图片描述:", imageDescriptions);

  // ───── Step A: Pre-fetch cover image from Unsplash (unless image description mode) ─────
  let coverImageMarkdown = "";

  if (withImages && !imageDescriptions) {
    const engKeywords = await translateToEnglishKeywords(topic, { ...config, apiKey });
    if (engKeywords) {
      const imageUrl = await searchUnsplash(engKeywords);
      if (imageUrl) {
        coverImageMarkdown = `![封面大图](${imageUrl})\n\n`;
      }
    }
  }

  // ───── Build user prompt ─────
  const imageDescInstruction = imageDescriptions
    ? `\n\n【配图要求】在每个 ## 二级标题下方插入配图建议，格式为：【配图建议：详细中文画面描述（主体、构图、场景、色调、风格，不少于60字） | English keywords for image generation】（N 从 1 开始递增）。这是强制要求，不可省略。不要使用 Markdown 图片语法，不要生成任何图片 URL。`
    : "";

  const userPrompt = extraPrompt
    ? `写一篇关于以下主题的文章：${topic}\n\n额外要求：${extraPrompt}\n\n目标字数：${wordCount} 字（必须严格达标，误差不超过10%。如果篇幅不够，请扩充案例、细节和论述深度）${imageDescInstruction}`
    : `写一篇关于以下主题的文章：${topic}\n\n目标字数：${wordCount} 字（必须严格达标，误差不超过10%。如果篇幅不够，请扩充案例、细节和论述深度）${imageDescInstruction}`;

  // ───── Step B: Streaming LLM call with image pre-pended ─────
  const startTime = Date.now();
  let totalTokens = 0;
  let fullContent = "";
  let status: "success" | "failed" = "success";
  let errorDetail = "";
  let imagePushed = false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Push cover image as the very first chunk
        if (coverImageMarkdown) {
          imagePushed = true;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ content: coverImageMarkdown })}\n\n`,
            ),
          );
        }

        // Call LLM
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ];
        const modelName = config.model || "deepseek-chat";

        // Model risk warning
        if (modelName.includes("reasoner") || modelName.includes("r1")) {
          console.log("[警告] 当前使用 R1 推理模型，由于后台 <think> 过程不输出到前端，可能产生极大的隐形 Token 消耗！");
        }

        const payload = {
          model: modelName,
          messages,
          max_tokens: Math.min(wordCount * 3, 8000),
          temperature: 0.85,
          top_p: 0.95,
          stream: true,
          stream_options: { include_usage: true },
        };

        console.log("[排雷] Payload messages 字符长度:", JSON.stringify(messages).length);
        console.log("[排雷] 完整请求体长度:", JSON.stringify(payload).length);

        const llmRes = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120_000),
        });

        if (!llmRes.ok) {
          const errText = await llmRes.text().catch(() => "");
          status = "failed";

          if (llmRes.status === 402 || errText.includes("Insufficient")) {
            errorDetail = "API 余额不足，请前往后台充值或更换 API Key。";
          } else if (llmRes.status === 401 || llmRes.status === 403) {
            errorDetail = "API Key 无效或已过期，请检查后台配置。";
          } else if (llmRes.status >= 500) {
            errorDetail = "模型服务暂时不可用，请稍后重试。";
          } else {
            errorDetail = `模型调用失败 (${llmRes.status})：${errText.slice(0, 200)}`;
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorDetail })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        const reader = llmRes.body?.getReader();
        if (!reader) {
          status = "failed";
          controller.close();
          return;
        }

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
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              // Capture official usage from final chunk
              if (parsed.usage) {
                totalTokens = parsed.usage.total_tokens || totalTokens;
                console.log("[排雷] 官方返回真实模型:", modelName);
                console.log("[排雷] 官方真实消耗 (Prompt/Completion/Total):",
                  parsed.usage.prompt_tokens,
                  parsed.usage.completion_tokens,
                  parsed.usage.total_tokens,
                );
              }

              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                // Use estimate until real usage arrives
                if (!totalTokens) {
                  totalTokens = Math.round(
                    (fullContent.length + userPrompt.length) / 1.5,
                  );
                }
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ content: delta })}\n\n`,
                  ),
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Fallback: estimate if no real usage data received
        if (!totalTokens) {
          totalTokens = Math.round((fullContent.length + userPrompt.length) / 1.5);
        }

        console.log("[排雷] 流式完成. 累积字符:", fullContent.length, "估算token:", totalTokens);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err: unknown) {
        status = "failed";
        if (err instanceof DOMException && err.name === "TimeoutError") {
          errorDetail = "生成超时，请检查 API 配置或稍后重试。";
        } else if (err instanceof TypeError && err.message.includes("fetch")) {
          errorDetail = "无法连接到模型服务，请检查网络或 API 地址。";
        } else {
          errorDetail = err instanceof Error ? err.message : "未知错误";
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorDetail })}\n\n`,
          ),
        );
      } finally {
        controller.close();

        // Deduct points on success
        if (status === "success") {
          try {
            const { deductPoints } = await import("@/lib/db");
            await deductPoints(userName, pointsCost, userEmail);
            console.log("[积分] 扣费成功:", userName, pointsCost, "积分");
          } catch (e) {
            console.error("[积分] 扣费失败:", userName, pointsCost, e instanceof Error ? e.message : e);
          }
        }

        // Write generation log (tokenUsed = real DeepSeek tokens for audit only)
        const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
        try {
          const { createLog } = await import("@/lib/db");
          await createLog({
            id: `gen-${Date.now().toString(36)}`,
            topic,
            wordCount,
            tokenUsed: totalTokens, // DeepSeek real usage (audit only)
            pointsUsed: pointsCost,
            duration,
            model: config.model || "deepseek-chat",
            status,
            userName,
          });
        } catch {
          // silent
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
