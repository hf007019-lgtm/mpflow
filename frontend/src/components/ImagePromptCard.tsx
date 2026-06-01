"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Loader2, Image } from "lucide-react";
import { generateImagePrompt, STYLE_LABELS, type PromptStyle } from "@/lib/image-prompt";

const STYLES: PromptStyle[] = ["cinematic", "anime", "minimal", "3d", "watercolor"];

export function ImagePromptCard({ selectedText, onClose }: { selectedText: string; onClose: () => void }) {
  const [style, setStyle] = useState<PromptStyle>("cinematic");
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    setPrompt("");
    try {
      const result = await generateImagePrompt(selectedText, style);
      setPrompt(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-4 space-y-3 w-80">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">画面灵感</span>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-sm">&times;</button>
      </div>

      {/* style selector */}
      <div className="flex flex-wrap gap-1.5">
        {STYLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStyle(s); setPrompt(""); }}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              style === s
                ? "border-gray-800 bg-gray-800 text-white"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {STYLE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* selected text preview */}
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 italic">
        「{selectedText.slice(0, 100)}」
      </p>

      {/* generate button */}
      {!prompt && (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中…</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> 生成配图提示词</>
          )}
        </button>
      )}

      {/* error */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* prompt card */}
      {prompt && (
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-2">
          <p className="text-xs font-mono text-gray-700 leading-relaxed break-all">
            {prompt}
          </p>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={copy}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors ${
                copied
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {copied ? (
                <><Check className="w-3 h-3" /> 已复制</>
              ) : (
                <><Copy className="w-3 h-3" /> 一键复制</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
