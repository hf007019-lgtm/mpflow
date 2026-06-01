"use client";

import { useState, useCallback } from "react";
import { X, Sparkles, Loader2, ImagePlus, Download, AlertCircle } from "lucide-react";
import { generateImages } from "@/lib/api";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Default prompt — pre-filled from article image descriptions or empty */
  defaultPrompt?: string;
  /** Price per AI-generated image, from /api/settings/pricing */
  pricePerImage: number;
  /** Called when user clicks "插入文章" on an image */
  onInsertImage: (url: string, prompt: string) => void;
}

const COUNT_OPTIONS = [
  { value: 1, label: "1 张" },
  { value: 2, label: "2 张" },
  { value: 4, label: "4 张" },
];

export function ImageGenDrawer({ open, onClose, defaultPrompt = "", pricePerImage, onInsertImage }: Props) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ url?: string; error?: string }[]>([]);
  const [error, setError] = useState("");
  const [insertedIdx, setInsertedIdx] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("请输入图片描述词");
      return;
    }
    setError("");
    setLoading(true);
    setImages([]);
    try {
      const result = await generateImages({ prompt: trimmed, count });
      setImages(result.images);
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片生成失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [prompt, count]);

  const totalCost = count * pricePerImage;

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-[420px] bg-white shadow-2xl border-l border-stone-200/60 flex flex-col animate-in slide-in-from-right duration-300">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D97757]" />
            <h2 className="text-[15px] font-semibold text-stone-800">AI 智能配图</h2>
            <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">DALL·E 3</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* prompt */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-stone-500">生图提示词</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的画面，越详细效果越好…"
              maxLength={2000}
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-stone-200/60 bg-stone-50 text-[13px] outline-none focus:border-stone-300 focus:bg-white resize-none transition-colors"
            />
            <div className="text-right text-[10px] text-stone-400">{prompt.length}/2000</div>
          </div>

          {/* count selector */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-stone-500">生成数量</label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCount(opt.value)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-[13px] font-medium transition-colors",
                    count === opt.value
                      ? "border-[#D97757] bg-[#D97757]/5 text-[#D97757]"
                      : "border-stone-200/60 text-stone-500 hover:bg-stone-50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || prompt.trim().length < 2}
            className={cn(
              "w-full py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 flex items-center justify-center gap-2",
              prompt.trim().length >= 2 && !loading
                ? "bg-[#D97757] text-white hover:bg-[#C5694A] hover:shadow-md"
                : "bg-gray-100 text-gray-400 cursor-not-allowed",
            )}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />生成中（约 10-20 秒）…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" />开始生成 (-{totalCost} 积分)</>
            )}
          </button>

          {/* error */}
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200/60 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          {/* results grid */}
          {images.length > 0 && (
            <div className="space-y-3">
              <p className="text-[12px] font-medium text-stone-500">
                生成结果 ({images.filter((i) => i.url).length}/{images.length})
              </p>
              <div className={cn(
                "grid gap-2",
                images.length === 1 ? "grid-cols-1" : "grid-cols-2",
              )}>
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="relative group rounded-lg overflow-hidden border border-stone-200/60 bg-stone-100 aspect-square"
                  >
                    {img.url ? (
                      <>
                        <img
                          src={img.url}
                          alt={`生成图片 ${i + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <a
                            href={img.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full bg-white/90 text-stone-700 hover:bg-white transition-colors"
                            title="查看原图"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              onInsertImage(img.url!, prompt);
                              setInsertedIdx(i);
                              setTimeout(() => setInsertedIdx(null), 2000);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#D97757] text-white text-[12px] font-medium hover:bg-[#C5694A] transition-colors"
                          >
                            {insertedIdx === i ? (
                              "已插入 ✓"
                            ) : (
                              <><ImagePlus className="w-3 h-3" />插入文章</>
                            )}
                          </button>
                        </div>
                      </>
                    ) : img.error ? (
                      <div className="absolute inset-0 flex items-center justify-center p-3">
                        <p className="text-[11px] text-red-500 text-center">{img.error}</p>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-stone-300 animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* loading placeholder when no results yet */}
          {loading && images.length === 0 && (
            <div className="space-y-3 animate-pulse">
              <div className={cn("grid gap-2", count === 1 ? "grid-cols-1" : "grid-cols-2")}>
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-stone-100 border border-stone-200/60" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
