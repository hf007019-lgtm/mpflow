/* ───── AI 工具箱：标题/扩写/缩写/SEO/检测 ───── */

const BASE = "";

async function quickLLM(system: string, user: string): Promise<string> {
  const res = await fetch(`${BASE}/api/generate/tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, user }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ detail: "请求失败" }))).detail);
  const data = await res.json();
  return data.result || "";
}

/** 爆款标题生成 */
export async function generateTitles(keywords: string): Promise<string[]> {
  const result = await quickLLM(
    "你是顶级公众号标题专家。根据关键词生成5个吸睛标题，覆盖悬念式、数据式、共情式。每行一个，不要编号。",
    `关键词：${keywords}`,
  );
  return result.split("\n").filter(Boolean).slice(0, 5);
}

/** 扩写/缩写 */
export async function transformText(text: string, mode: "expand" | "condense"): Promise<string> {
  const sys = mode === "expand"
    ? "将以下内容通俗化扩写，增加案例和细节，保持口语化。只输出结果。"
    : "将以下内容提炼为核心要点，大幅精简但保留关键逻辑。只输出结果。";
  return quickLLM(sys, text);
}

/** SEO 摘要提取 */
export async function extractSEO(fullText: string): Promise<{ summary: string; keywords: string }> {
  const result = await quickLLM(
    "从以下文章中提取：1) 一段54字以内的分享描述 2) 3-5个核心关键词。格式：摘要：xxx\n关键词：a,b,c",
    fullText.slice(0, 3000),
  );
  const summary = result.match(/摘要[：:]\s*(.+)/)?.[1] || "";
  const keywords = result.match(/关键词[：:]\s*(.+)/)?.[1] || "";
  return { summary, keywords };
}

/** 敏感词与错别字扫描 */
export async function scanContent(text: string): Promise<{ issues: { position: number; word: string; suggestion: string; type: "typo" | "sensitive" }[] }> {
  const result = await quickLLM(
    `检测以下文章中的问题。返回 JSON 数组格式：[{"word":"问题词","suggestion":"建议修改","type":"typo或sensitive","position":字符位置}]。只返回JSON，不要其他文字。`,
    text.slice(0, 4000),
  );
  try {
    const issues = JSON.parse(result);
    return { issues: Array.isArray(issues) ? issues : [] };
  } catch {
    return { issues: [] };
  }
}
