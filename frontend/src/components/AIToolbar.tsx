"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Lightbulb, Maximize2, Minimize2, Search, Shield, X, Loader2, Copy, Check } from "lucide-react";
import { generateTitles, transformText, extractSEO, scanContent } from "@/lib/ai-tools";

interface ToolResult {
  type: "titles" | "transform" | "seo" | "scan";
  title: string;
  content: React.ReactNode;
}

export function AIToolbar({ editorContent, onInsert }: { editorContent: string; onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<ToolResult[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [scanIssues, setScanIssues] = useState<{ position: number; word: string; suggestion: string; type: string }[]>([]);

  const runTool = async (tool: string) => {
    setLoading(tool);
    try {
      if (tool === "titles") {
        const kw = keywordInput || editorContent.slice(0, 100);
        const titles = await generateTitles(kw);
        setResults((prev) => [{
          type: "titles", title: "爆款标题",
          content: (
            <div className="space-y-1.5">
              {titles.map((t, i) => (
                <div key={i} className="flex items-center justify-between group hover:bg-gray-50 px-2 py-1.5 rounded-md -mx-2">
                  <span className="text-sm text-gray-700">{t}</span>
                  <button
                    onClick={() => onInsert(t + "\n")}
                    className="opacity-0 group-hover:opacity-100 text-xs text-[#D97757] hover:underline shrink-0 ml-2"
                  >
                    插入
                  </button>
                </div>
              ))}
            </div>
          ),
        }, ...prev.slice(0, 4)]);
      } else if (tool === "expand") {
        const text = editorContent.slice(0, 2000);
        const expanded = await transformText(text, "expand");
        setResults((prev) => [{
          type: "transform", title: "扩写结果",
          content: (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {expanded}
              <button onClick={() => onInsert(expanded)} className="block mt-2 text-xs text-[#D97757] hover:underline">插入到文章</button>
            </div>
          ),
        }, ...prev.slice(0, 4)]);
      } else if (tool === "condense") {
        const text = editorContent.slice(0, 2000);
        const condensed = await transformText(text, "condense");
        setResults((prev) => [{
          type: "transform", title: "缩写结果",
          content: (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {condensed}
              <button onClick={() => onInsert(condensed)} className="block mt-2 text-xs text-[#D97757] hover:underline">插入到文章</button>
            </div>
          ),
        }, ...prev.slice(0, 4)]);
      } else if (tool === "seo") {
        const { summary, keywords } = await extractSEO(editorContent.slice(0, 3000));
        setResults((prev) => [{
          type: "seo", title: "SEO 摘要",
          content: (
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-400">分享描述：</span><span className="text-gray-700">{summary}</span></div>
              <div><span className="text-gray-400">关键词：</span><span className="text-gray-700">{keywords}</span></div>
            </div>
          ),
        }, ...prev.slice(0, 4)]);
      } else if (tool === "scan") {
        const { issues } = await scanContent(editorContent.slice(0, 4000));
        setScanIssues(issues);
        setResults((prev) => [{
          type: "scan", title: "合规检测",
          content: issues.length === 0 ? (
            <p className="text-sm text-emerald-600">未发现明显问题</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {issues.map((iss, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${iss.type === "sensitive" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                  <span className="font-medium">「{iss.word}」</span> → {iss.suggestion}
                  <span className="ml-2 text-gray-400">{iss.type === "sensitive" ? "敏感词" : "错别字"}</span>
                </div>
              ))}
            </div>
          ),
        }, ...prev.slice(0, 4)]);
      }
    } catch (err: unknown) {
      setResults((prev) => [{ type: "scan" as const, title: "错误", content: <p className="text-sm text-red-500">{(err as Error).message}</p> }, ...prev]);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative">
      {/* toolbar */}
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors ${
            open ? "border-neutral-400 bg-neutral-100 text-neutral-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Sparkles className="w-3 h-3" />AI 工具
        </button>
      </div>

      {/* panel */}
      {open && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">AI 工具箱</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          {/* tool buttons */}
          <div className="grid grid-cols-2 gap-2">
            <ToolBtn icon={Lightbulb} label="爆款标题" loading={loading === "titles"} onClick={() => runTool("titles")} />
            <ToolBtn icon={Search} label="SEO 摘要" loading={loading === "seo"} onClick={() => runTool("seo")} />
            <ToolBtn icon={Maximize2} label="扩写" loading={loading === "expand"} onClick={() => runTool("expand")} />
            <ToolBtn icon={Minimize2} label="缩写" loading={loading === "condense"} onClick={() => runTool("condense")} />
            <ToolBtn icon={Shield} label="合规检测" loading={loading === "scan"} onClick={() => runTool("scan")} span />
          </div>

          {/* keyword input for title generator */}
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="标题关键词（可选）…"
            className="w-full text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-gray-300"
          />

          {/* results */}
          {results.map((r, i) => (
            <div key={i} className="border-t border-gray-100 pt-3">
              <p className="text-[11px] font-medium text-gray-400 mb-1.5">{r.title}</p>
              {r.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon: Icon, label, loading, onClick, span }: { icon: React.ComponentType<{ className?: string }>; label: string; loading: boolean; onClick: () => void; span?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={!!loading}
      className={`flex items-center gap-1.5 text-[12px] px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors ${span ? "col-span-2" : ""}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}
