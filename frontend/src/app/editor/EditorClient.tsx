"use client";

import { useState, useEffect, useRef, type FormEvent, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Copy, Check, AlertCircle, Palette, Eye, Edit3, History, Clock, PenLine, Sparkles } from "lucide-react";
import { generateArticleStream } from "@/lib/api";
import { PRESETS, getPreset } from "@/lib/style-presets";
import { copyWechatHTML } from "@/lib/wechat-exporter";
import { ComponentBuilder } from "@/components/ComponentBuilder";
import { ImageGenDrawer } from "@/components/ImageGenDrawer";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function EditorClient() {
  const [isAdmin, setIsAdmin] = useState(true);

  const [topic, setTopic] = useState("");
  const [wordCount, setWordCount] = useState(500);
  const [withImages, setWithImages] = useState(false);
  const [extra, setExtra] = useState("");

  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedWechat, setCopiedWechat] = useState(false);
  const [imageDescriptions, setImageDescriptions] = useState(false);
  const [activePreset, setActivePreset] = useState("classic");
  const [insertedComponents, setInsertedComponents] = useState<{ html: string; label: string; position: "top" | "bottom" }[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  /* ───── dynamic pricing ───── */
  const [pricing, setPricing] = useState({ price_base_500_words: 1, price_auto_image: 5, price_image_desc: 1, price_ai_image: 20 });
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);

  /* ───── AI image drawer ───── */
  const [showImageDrawer, setShowImageDrawer] = useState(false);
  const [drawerPrompt, setDrawerPrompt] = useState("");

  const handleInsertImage = useCallback((url: string, prompt: string) => {
    const md = `![${prompt.slice(0, 60)}](${url})`;
    // Insert at cursor position in edit mode, or append to markdown
    if (editMode) {
      setMarkdown((prev) => prev + "\n\n" + md + "\n");
    } else {
      setMarkdown((prev) => prev + "\n\n" + md + "\n");
    }
    addLog("INFO", `已插入 AI 生成图片: ${url.slice(0, 40)}...`);
  }, [editMode]);

  useEffect(() => {
    fetch("/api/settings/pricing")
      .then((r) => (r.ok ? r.json() : { price_base_500_words: 1, price_auto_image: 5, price_image_desc: 1, price_ai_image: 20 }))
      .then((d) => setPricing(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/user/points")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setPointsBalance(d.pointsBalance); })
      .catch(() => {});
  }, []);

  const refreshPointsBalance = useCallback(() => {
    fetch("/api/user/points")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setPointsBalance(d.pointsBalance); })
      .catch(() => {});
  }, []);

  const calculatePoints = useCallback(() => {
    return 1; // Flat 1 point per article generation
  }, []);

  /* ───── history (localStorage, max 5) ───── */
  const HISTORY_KEY = "mpflow_history";

  const loadHistory = (): { topic: string; wordCount: number; time: string }[] => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch { return []; }
  };

  const [history, setHistory] = useState<{ topic: string; wordCount: number; time: string; content?: string }[]>([]);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const saveToHistory = (topic: string, wordCount: number, content: string) => {
    const now = new Date().toLocaleString("zh-CN");
    const updated = [{ topic, wordCount, content: content.slice(0, 5000), time: now }, ...loadHistory()].slice(0, 5);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const addLog = (level: string, msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-50), `[${ts}] [${level}] ${msg}`]);
  };

  const insertComponentHTML = (html: string, label: string, position: "top" | "bottom" = "bottom") => {
    if (!html || html.trim().length < 10) {
      addLog("ERROR", "组件 HTML 为空或过短，插入失败");
      return;
    }
    setInsertedComponents((prev) => [...prev, { html, label, position }]);
    addLog("INFO", `组件已插入: ${label} (${position})`);
  };

  const removeComponent = (index: number) => {
    setInsertedComponents((prev) => prev.filter((_, i) => i !== index));
    addLog("INFO", `已移除第 ${index + 1} 个组件`);
  };

  const previewRef = useRef<HTMLDivElement>(null);

  /* ───── streaming submit with abort ───── */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      console.log("[handleSubmit] 1. 表单提交触发");

      const trimmed = topic.trim();
      console.log("[handleSubmit] 2. topic trimmed:", JSON.stringify(trimmed), "length:", trimmed.length);

      if (!trimmed || trimmed.length < 2) {
        console.log("[handleSubmit] 2a. 校验失败：主题过短，阻断提交");
        setError("文章主题至少需要 2 个字符，请输入后再提交。");
        return;
      }

      if (loading) {
        console.log("[handleSubmit] 2b. 重复提交拦截，loading:", loading);
        return;
      }

      // Abort any pending request
      console.log("[handleSubmit] 3. 创建 AbortController");
      if (abortRef.current) {
        abortRef.current.abort();
        console.log("[handleSubmit] 3a. 已中止上一请求");
      }
      const controller = new AbortController();
      abortRef.current = controller;

      // Check points balance before generating
      const requiredPoints = calculatePoints();
      try {
        const pointsRes = await fetch("/api/user/points");
        if (pointsRes.ok) {
          const pointsData = await pointsRes.json();
          if (pointsData.pointsBalance < requiredPoints) {
            setError(`积分不足：需要 ${requiredPoints} 积分，当前余额 ${pointsData.pointsBalance} 积分`);
            return;
          }
        }
      } catch { /* proceed — don't block generation on balance check failure */ }

      // Deduct points before generation (no refund on abort/failure)
      try {
        const deductRes = await fetch("/api/user/points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "article_generate" }),
        });
        if (deductRes.ok) {
          const d = await deductRes.json();
          setPointsBalance(d.pointsBalance);
          window.dispatchEvent(new Event("points-updated"));
          console.log("[积分] 扣费成功:", d.cost ?? "?", "积分, 新余额:", d.pointsBalance);
        } else {
          const errData = await deductRes.json().catch(() => ({ error: "扣费失败" }));
          setError(errData.error || "积分扣费失败，请重试");
          return;
        }
      } catch {
        setError("积分扣费失败，请检查网络后重试");
        return;
      }

      console.log("[handleSubmit] 4. 设置 loading=true，清空旧状态");
      setLoading(true);
      setError("");
      setMarkdown("");
      setCopied(false);
      setCopiedWechat(false);

      let accumulated = "";

      try {
        const params = {
          topic: trimmed.slice(0, 500),
          word_count: Math.min(Math.max(wordCount, 500), 5000),
          with_images: withImages,
          image_descriptions: imageDescriptions,
          additional_instructions: extra.trim().slice(0, 500),
        };
        console.log("[handleSubmit] 5. 请求参数:", JSON.stringify(params));

        console.log("[handleSubmit] 6. 调用 generateArticleStream…");
        const stream = generateArticleStream(params, controller.signal);
        console.log("[handleSubmit] 7. stream 对象已创建，开始 for await 迭代");

        for await (const chunk of stream) {
          accumulated += chunk;
          setMarkdown(accumulated);
        }

        console.log("[handleSubmit] 8. 生成完成，累计字符:", accumulated.length);

        if (accumulated) {
          saveToHistory(trimmed, wordCount, accumulated);
          console.log("[handleSubmit] 9. 已保存到历史记录");
        }
      } catch (err: unknown) {
        console.error("[handleSubmit] CATCH 捕获错误:", err);
        if (err instanceof DOMException && err.name === "AbortError") {
          console.log("[handleSubmit] 用户中止生成");
          if (accumulated) {
            setMarkdown(accumulated + "\n\n> ⏹️ 已停止生成");
          }
        } else {
          const message = err instanceof Error ? err.message : "生成中断：遇到了一些网络波动，请检查 API 配置或重试。";
          console.error("[handleSubmit] 错误详情:", message, "错误类型:", err?.constructor?.name);
          setError(message);
          if (accumulated) {
            setMarkdown(accumulated + "\n\n> ⚠️ 生成中断：遇到了一些网络波动，请检查 API 配置或重试。");
          }
        }
      } finally {
        console.log("[handleSubmit] FINALLY: 重置 loading=false, abortRef=null");
        setLoading(false);
        abortRef.current = null;
      }
    },
    [topic, wordCount, withImages, extra, imageDescriptions, loading],
  );

  /* ───── stop generation ───── */
  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  /* ───── plain markdown copy ───── */
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdown]);

  /* ───── WeChat HTML copy (top components → markdown → bottom components) ───── */
  const handleCopyWechat = useCallback(async () => {
    const previewEl = previewRef.current;
    if (!previewEl) return;

    const container = document.createElement("div");

    // Top-position components first
    insertedComponents
      .filter((c) => c.position === "top")
      .forEach((c) => {
        const div = document.createElement("div");
        div.innerHTML = c.html;
        container.appendChild(div);
      });

    // Markdown content in the middle
    if (previewEl) {
      const content = document.createElement("div");
      content.innerHTML = previewEl.innerHTML;
      container.appendChild(content);
    }

    // Bottom-position components last
    insertedComponents
      .filter((c) => c.position === "bottom")
      .forEach((c) => {
        const div = document.createElement("div");
        div.innerHTML = c.html;
        container.appendChild(div);
      });

    const preset = getPreset(activePreset) || PRESETS[0];
    const ok = await copyWechatHTML(container, preset);
    setCopiedWechat(true);
    setTimeout(() => setCopiedWechat(false), 2000);
  }, [activePreset, insertedComponents]);

  return (
    <>
      {/* animated dot grid background */}
      <style>{`
        @keyframes fadeIn { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes smoothDrift {
          0% { background-position: 0px 0px; }
          100% { background-position: 40px 40px; }
        }
        .claude-animated-bg {
          animation: smoothDrift 120s linear infinite;
        }
      `}</style>

      <div className="h-[calc(100vh-4rem)] bg-stone-50 text-stone-800 antialiased overflow-hidden relative">
        {/* dot grid */}
        <div
          className="absolute inset-0 z-0 pointer-events-none claude-animated-bg"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23a8a29e' fill-opacity='0.15'/%3E%3C/svg%3E")`,
            backgroundSize: "40px 40px",
            WebkitMaskImage:
              "radial-gradient(ellipse at 50% 0%, black 0%, transparent 80%)",
            maskImage:
              "radial-gradient(ellipse at 50% 0%, black 0%, transparent 80%)",
          }}
        />

        {/* content */}
        <div className="relative z-10 flex h-screen w-full pointer-events-none">
          {/* ============ LEFT PANEL ============ */}
          <aside className="w-[420px] shrink-0 flex flex-col bg-white/40 backdrop-blur-xl border-r border-white/20 pointer-events-auto">
            {/* header */}
            <div className="px-7 py-4 border-b border-stone-100 flex items-center gap-3 shrink-0">
              <h1 className="text-[15px] font-semibold tracking-tight text-stone-800 leading-none">
                创作中心
              </h1>
              <span className="text-[11px] text-stone-400 leading-none">
                AI 智能写作
              </span>
              <button
                type="button"
                onClick={() => setIsAdmin((v) => !v)}
                className="w-4 h-4 ml-auto rounded-full opacity-0 hover:opacity-20 transition-opacity"
                title="Toggle admin"
              />
            </div>

            {/* form — scrollable content */}
            <form id="editorForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-4 p-5 pb-28">

                {/* ───── Group 1: 核心创作区 ───── */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">内容输入</p>

                  {/* topic */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">文章主题</label>
                    <div className={cn(
                      "relative rounded-lg border transition-colors duration-200",
                      "bg-stone-50 border-stone-200/50",
                      "focus-within:bg-white focus-within:border-stone-300 focus-within:ring-1 focus-within:ring-stone-300/50",
                    )}>
                      <textarea
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="输入你想写的主题…"
                        maxLength={500}
                        rows={4}
                        className="w-full bg-transparent px-4 pt-3 pb-1 text-[14px] text-stone-800 placeholder:text-stone-400 resize-none outline-none leading-relaxed"
                      />
                      <div className="flex justify-end px-4 pb-2.5">
                        <span className={cn("text-[10px] tabular-nums", topic.length > 450 ? "text-amber-600" : "text-stone-400")}>
                          {topic.length}&thinsp;/&thinsp;500
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* extra instructions */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      补充要求
                      <span className="text-stone-400 font-normal ml-1">可选</span>
                    </label>
                    <div className={cn(
                      "rounded-lg border transition-colors duration-200",
                      "bg-stone-50 border-stone-200/50",
                      "focus-within:bg-white focus-within:border-stone-300 focus-within:ring-1 focus-within:ring-stone-300/50",
                    )}>
                      <input
                        type="text"
                        value={extra}
                        onChange={(e) => setExtra(e.target.value)}
                        placeholder="写作风格、侧重点…"
                        maxLength={500}
                        className="w-full bg-transparent px-4 py-2.5 text-[14px] text-stone-800 placeholder:text-stone-400 outline-none rounded-lg"
                      />
                    </div>
                  </div>

                  {/* word count slider */}
                  {isAdmin && (
                    <div className="space-y-2.5 pt-1">
                      <label className="text-sm font-medium text-neutral-700 flex items-center justify-between">
                        目标字数
                        <span className="text-neutral-600 font-medium tabular-nums text-[13px]">{wordCount.toLocaleString()} 字</span>
                      </label>
                      <input
                        type="range" min={500} max={5000} step={100}
                        value={wordCount}
                        onChange={(e) => setWordCount(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-stone-200 accent-[#D97757]
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D97757] [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                      />
                      <div className="flex justify-between text-[10px] text-stone-400"><span>500</span><span>5,000</span></div>
                    </div>
                  )}
                </div>

                {/* ───── Group 2: 排版与附加配置 ───── */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">效果控制</p>

                  {/* image toggles */}
                  {isAdmin && (
                    <>
                      {/* AI image generation button */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">AI 智能配图</span>
                        <button
                          type="button"
                          onClick={() => {
                            // Extract prompt from existing image descriptions in the article
                            const descMatch = markdown.match(/图片描述：(.+?) \|/);
                            setDrawerPrompt(descMatch ? descMatch[1].trim() : "");
                            setShowImageDrawer(true);
                          }}
                          className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-[#D97757]/30 text-[#D97757] bg-white hover:bg-[#D97757]/5 transition-colors font-medium"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          打开面板
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">图片描述</span>
                        <button
                          type="button" role="switch" aria-checked={imageDescriptions}
                          onClick={() => setImageDescriptions((v) => !v)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
                            imageDescriptions ? "bg-[#D97757]" : "bg-stone-200",
                          )}
                        >
                          <span className={cn(
                            "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                            imageDescriptions ? "translate-x-[18px]" : "translate-x-[3px]",
                          )} />
                        </button>
                      </div>
                    </>
                  )}

                  {/* style presets */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5" />排版风格
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESETS.map((p) => (
                        <button key={p.id} type="button" onClick={() => setActivePreset(p.id)}
                          className={cn(
                            "text-left px-3 py-2 rounded-md border text-[12px] transition-colors",
                            activePreset === p.id
                              ? "border-neutral-800 bg-neutral-50 text-neutral-800 font-medium"
                              : "border-gray-200 text-neutral-500 hover:bg-gray-50",
                          )}
                        >
                          <div className="font-medium">{p.name}</div>
                          <div className="text-[10px] opacity-60 mt-0.5">{p.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* wechat components */}
                  <ComponentBuilder onInsert={insertComponentHTML} />
                </div>

                {/* ───── Group 3: 历史记录（可折叠）─── */}
                {history.length > 0 && (
                  <HistoryPanel
                    history={history as any}
                    onSelect={(h) => {
                      setTopic(h.topic);
                      setWordCount(h.wordCount);
                      if (h.content) {
                        setMarkdown(h.content);
                        setEditMode(true);
                      }
                    }}
                    onClear={clearHistory}
                  />
                )}
              </div>
            </form>

            {/* ───── Sticky CTA ───── */}
            <div className="sticky bottom-0 shrink-0 px-7 py-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-10">
              <div className="flex justify-center gap-2">
                {/* stop button — visible during generation */}
                {loading && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="px-6 py-2.5 rounded-full text-sm font-medium bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
                    停止生成
                  </button>
                )}

                {/* generate button */}
                <button
                  type="submit"
                  form="editorForm"
                  disabled={loading || topic.trim().length < 2}
                  className={cn(
                    "px-8 py-2.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
                    topic.trim().length >= 2 && !loading
                      ? "bg-[#D97757] text-white hover:bg-[#C5694A] hover:shadow-md"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed",
                  )}
                >
                  {loading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中…</>
                  ) : (
                    `开始生成 (-${calculatePoints()} 积分)`
                  )}
                </button>
              </div>
            </div>

            {/* sidebar footer: user */}
            <SidebarUser />
          </aside>

          {/* ============ RIGHT PANEL ============ */}
          <section className="flex-1 flex flex-col min-w-0 bg-transparent pointer-events-auto">
            {/* top bar */}
            <div className="px-7 py-5 border-b border-stone-200/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-medium text-stone-400 uppercase tracking-widest">
                  {editMode ? "编辑" : "预览"}
                </h2>
                {markdown && (
                  <button
                    type="button"
                    onClick={() => setEditMode(!editMode)}
                    className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border transition-colors ${
                      editMode
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-stone-200/60 text-stone-500 hover:text-stone-700 bg-white"
                    }`}
                  >
                    {editMode ? <><Eye className="w-3 h-3" />预览</> : <><Edit3 className="w-3 h-3" />编辑</>}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* points cost — always visible once content exists */}
                {(loading || markdown) && (
                  <span className="text-sm font-semibold text-[#D97757] tabular-nums font-mono">
                    -{calculatePoints()} 积分消耗
                  </span>
                )}
                {markdown && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={cn(
                        "flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors duration-150",
                        copied
                          ? "border-stone-300 text-stone-700 bg-stone-100"
                          : "border-stone-200/60 text-stone-500 hover:text-stone-700 hover:border-stone-300 bg-white",
                      )}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          复制 Markdown
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyWechat}
                      className={cn(
                        "flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors duration-150 font-medium",
                        copiedWechat
                          ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                          : "border-[#D97757]/30 text-[#D97757] hover:bg-[#D97757]/5 bg-white",
                      )}
                    >
                      {copiedWechat ? (
                        <>
                          <Check className="w-3 h-3" />
                          已复制，去微信 Ctrl+V
                        </>
                      ) : (
                        "一键复制至微信公众号"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* content */}
            <div className="flex-1 overflow-y-auto">
              {/* error */}
              {error && (
                <div className="mx-7 mt-4 px-4 py-3 bg-red-50 border border-red-200/60 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-600 font-medium">
                      生成中断
                    </p>
                    <p className="text-[13px] text-red-500 mt-0.5 leading-relaxed">
                      {error}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="text-red-400 hover:text-red-600 text-sm shrink-0"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* loading skeleton */}
              {loading && !markdown && (
                <div className="max-w-2xl mx-auto px-8 py-12 space-y-5 animate-pulse">
                  <div className="h-5 bg-stone-200/60 rounded w-2/3" />
                  <div className="h-5 bg-stone-200/60 rounded w-1/3" />
                  <div className="h-28 bg-stone-100 rounded-2xl" />
                  <div className="h-5 bg-stone-200/60 rounded w-5/6" />
                  <div className="h-5 bg-stone-200/60 rounded w-2/3" />
                  <div className="h-28 bg-stone-100 rounded-2xl" />
                </div>
              )}

              {/* empty */}
              {!markdown && !loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-stone-200/60 shadow-sm flex items-center justify-center">
                      <PenLine className="w-6 h-6 text-stone-300" />
                    </div>
                    <div>
                      <p className="text-[15px] text-stone-500">
                        在左侧输入主题，点击生成
                      </p>
                      <p className="text-[13px] text-stone-400 mt-1">
                        文章将在此处实时预览
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* rendered markdown */}
              {markdown && (
                <div className="max-w-2xl mx-auto px-10 py-12">
                  {/* top-position components */}
                  {!editMode && insertedComponents.filter(c => c.position === "top").length > 0 && (
                    <div className="space-y-4 mb-6">
                      {insertedComponents
                        .filter((c) => c.position === "top")
                        .map((c, i) => (
                          <div key={`top-${i}`} className="relative group">
                            <div dangerouslySetInnerHTML={{ __html: c.html }} />
                            <button
                              type="button"
                              onClick={() => removeComponent(insertedComponents.indexOf(c))}
                              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-100 border border-red-200 text-red-400 hover:bg-red-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* edit mode: raw markdown textarea */}
                  {editMode ? (
                    <textarea
                      value={markdown}
                      onChange={(e) => setMarkdown(e.target.value)}
                      className="w-full min-h-[60vh] bg-transparent text-[15px] text-stone-800 font-mono leading-relaxed resize-none outline-none border-none p-0"
                      placeholder="在此编辑 Markdown…"
                    />
                  ) : (
                    <div ref={previewRef} className="prose-preview">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          img: ({ src, alt, ...imgProps }) => {
                            // Intercept legacy IMAGE_PLACEHOLDER URLs — render as suggestion card instead of <img>
                            if (typeof src === "string" && /IMAGE_PLACEHOLDER/i.test(src)) {
                              const match = src.match(/IMAGE_PLACEHOLDER_(\d+)/i);
                              const num = match ? match[1] : "?";
                              const descText = alt && alt !== "配图" ? alt : `配图建议 #${num}`;
                              return (
                                <div className="my-5 px-4 py-3.5 bg-amber-50 border border-dashed border-amber-300 rounded-lg space-y-2">
                                  <div className="flex items-center gap-1.5 text-[10px] text-amber-500 uppercase tracking-wider">
                                    <span>🖼</span>
                                    <span>配图建议 #{num}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setDrawerPrompt(descText);
                                        setShowImageDrawer(true);
                                      }}
                                      className="ml-auto text-[10px] px-2 py-0.5 rounded border border-amber-300 text-amber-600 hover:bg-white transition-colors"
                                    >
                                      去生图
                                    </button>
                                  </div>
                                  <p className="text-sm text-gray-600 leading-relaxed">{descText}</p>
                                  <p className="text-[11px] text-amber-400">此占位符来自旧版文章，已自动转为配图建议卡片。</p>
                                </div>
                              );
                            }
                            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                            return <img src={src} alt={alt} {...imgProps} />;
                          },
                          p: ({ children, ...props }) => {
                            const text = String(children);
                            if (text.startsWith("[图片描述：") && text.endsWith("]")) {
                              const inner = text.slice(1, -1); // remove [ ]
                              const parts = inner.split(" | ");
                              return (
                                <div className="my-5 px-4 py-3.5 bg-gray-50 border border-dashed border-gray-300 rounded-lg space-y-2">
                                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wider">
                                    <span>🖼</span>
                                    <span>AI 生图提示词</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        navigator.clipboard.writeText(inner);
                                        const btn = e.currentTarget;
                                        btn.textContent = "已复制!";
                                        setTimeout(() => { btn.textContent = "复制"; }, 1500);
                                      }}
                                      className="ml-auto text-[10px] px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:bg-white transition-colors"
                                    >
                                      复制
                                    </button>
                                  </div>
                                  {parts.length === 2 ? (
                                    <>
                                      <p className="text-sm text-gray-600 leading-relaxed">{parts[0]}</p>
                                      <p className="text-xs font-mono text-gray-400 leading-relaxed break-all">{parts[1]}</p>
                                    </>
                                  ) : (
                                    <p className="text-sm text-gray-600 leading-relaxed">{inner}</p>
                                  )}
                                </div>
                              );
                            }
                            return <p {...props}>{children}</p>;
                          },
                        }}
                      >
                        {markdown}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* bottom-position components */}
                  {!editMode && insertedComponents.filter(c => c.position === "bottom").length > 0 && (
                    <div className="space-y-6 mt-6">
                      {insertedComponents
                        .filter((c) => c.position === "bottom")
                        .map((c, i) => (
                          <div key={`bottom-${i}`} className="relative group">
                            <div dangerouslySetInnerHTML={{ __html: c.html }} />
                            <button
                              type="button"
                              onClick={() => removeComponent(insertedComponents.indexOf(c))}
                              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-100 border border-red-200 text-red-400 hover:bg-red-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* debug panel toggle — tiny button at bottom-right of preview */}
            <div className="shrink-0 border-t border-stone-200/40 px-7 py-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
              >
                {showDebug ? "隐藏" : "显示"}调试日志 ({debugLogs.length})
              </button>
              <span className="text-[10px] text-stone-400">
                组件: {insertedComponents.length} | 预设: {activePreset}
              </span>
            </div>

            {showDebug && (
              <div className="shrink-0 border-t border-stone-200/40 bg-stone-100 max-h-40 overflow-y-auto px-7 py-3">
                {debugLogs.length === 0 ? (
                  <p className="text-[11px] text-stone-400">暂无日志 — 操作组件时会自动记录</p>
                ) : (
                  debugLogs.map((line, i) => (
                    <pre
                      key={i}
                      className={`text-[11px] font-mono leading-relaxed ${
                        line.includes("ERROR") ? "text-red-500" : line.includes("WARN") ? "text-amber-500" : "text-stone-500"
                      }`}
                    >
                      {line}
                    </pre>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* AI Image Generation Drawer */}
      <ImageGenDrawer
        open={showImageDrawer}
        onClose={() => setShowImageDrawer(false)}
        defaultPrompt={drawerPrompt}
        pricePerImage={pricing.price_ai_image}
        onInsertImage={handleInsertImage}
      />
    </>
  );
}

/* ───── history panel (collapsible) ───── */
function HistoryPanel({
  history,
  onSelect,
  onClear,
}: {
  history: { topic: string; wordCount: number; time: string; content: string }[];
  onSelect: (h: { topic: string; wordCount: number; time: string; content: string }) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-3 h-3" />
          生成记录
          <span className="text-neutral-300">{history.length}</span>
        </span>
        <span className="text-[10px] text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {history.map((h, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(h)}
              className="w-full text-left px-2.5 py-2 rounded-md hover:bg-gray-50 transition-colors group"
            >
              <p className="text-[12px] font-medium text-neutral-700 truncate group-hover:text-neutral-900">
                {h.topic}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />{h.time}
                </span>
                <span className="text-[10px] text-neutral-400">{h.wordCount}字</span>
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="w-full text-center text-[10px] text-neutral-400 hover:text-red-500 transition-colors py-1"
          >
            清空记录
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarUser() {
  const [user, setUser] = useState<{ name?: string; email?: string; image?: string } | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  if (!user) return null;

  return (
    <div className="shrink-0 px-7 py-4 border-t border-stone-100">
      <div className="flex items-center gap-3">
        {user.image ? (
          <img src={user.image} alt="" className="w-7 h-7 rounded-full border border-stone-200" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-[11px] font-medium text-white">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-stone-700 truncate">{user.name || user.email}</p>
        </div>
        <button
          onClick={logout}
          className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          退出
        </button>
      </div>
    </div>
  );
}
