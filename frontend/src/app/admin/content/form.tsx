"use client";

import { useState } from "react";
import { Loader2, Check, Plus, Trash2, Eye } from "lucide-react";
import { saveLandingContent } from "@/lib/actions";
import type { FeatureItem } from "@/lib/db";

export function ContentForm({ initial }: {
  initial: { heroTitle: string; heroSubtitle: string; heroImageUrls: string[]; features: FeatureItem[] };
}) {
  const [heroTitle, setHeroTitle] = useState(initial.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(initial.heroSubtitle);
  const [heroImageUrls, setHeroImageUrls] = useState<string[]>(
    initial.heroImageUrls.length > 0 ? initial.heroImageUrls : [""],
  );
  const [features, setFeatures] = useState<FeatureItem[]>(initial.features);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  const updateFeature = (i: number, field: keyof FeatureItem, val: string) => {
    setFeatures((prev) => prev.map((f, j) => (j === i ? { ...f, [field]: val } : f)));
  };

  const addFeature = () => {
    setFeatures((prev) => [...prev, { icon: "Gauge", title: "", desc: "" }]);
  };

  const removeFeature = (i: number) => {
    setFeatures((prev) => prev.filter((_, j) => j !== i));
  };

  const updateImageUrl = (i: number, val: string) => {
    setHeroImageUrls((prev) => prev.map((url, j) => (j === i ? val : url)));
  };

  const addImageUrl = () => setHeroImageUrls((prev) => [...prev, ""]);
  const removeImageUrl = (i: number) => {
    setHeroImageUrls((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  };

  const handleSave = async () => {
    setSaving(true);
    const clean = heroImageUrls.filter((u) => u.trim().length > 0);
    await saveLandingContent({ heroTitle, heroSubtitle, heroImageUrls: clean, features });
    setSaving(false);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Hero Section */}
      <div className="bg-white rounded-xl border border-stone-200/60 p-6 space-y-5">
        <h3 className="text-[15px] font-semibold text-stone-800">主视觉区</h3>

        <div className="space-y-2">
          <label className="text-[13px] font-medium text-stone-500">主标题</label>
          <textarea
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-stone-200/60 bg-stone-50 text-[14px] text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-medium text-stone-500">副标题</label>
          <input
            type="text"
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-stone-200/60 bg-stone-50 text-[14px] text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
          />
        </div>

        {/* Multi-image URLs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-stone-500">主视觉图片（轮播）</label>
            <button
              type="button"
              onClick={addImageUrl}
              className="flex items-center gap-1 text-[12px] text-stone-500 hover:text-stone-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />添加图片
            </button>
          </div>

          {/* image preview strip */}
          {heroImageUrls.filter(Boolean).length > 0 && (
            <div className="flex gap-2 pb-1 overflow-x-auto">
              {heroImageUrls.filter(Boolean).map((url, i) => (
                <div key={i} className="w-20 h-12 shrink-0 rounded-lg border border-stone-200 overflow-hidden bg-stone-100">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {heroImageUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => updateImageUrl(i, e.target.value)}
                  placeholder={`图片 ${i + 1} URL — https://images.unsplash.com/...`}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200/60 bg-stone-50 text-[14px] text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
                />
                {heroImageUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeImageUrl(i)}
                    className="shrink-0 w-10 h-10 rounded-xl border border-red-200/60 text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white rounded-xl border border-stone-200/60 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-stone-800">特性卡片</h3>
          <button
            type="button"
            onClick={addFeature}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-stone-800 text-white hover:bg-stone-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />添加特性卡片
          </button>
        </div>
        {features.map((f, i) => (
          <div key={i} className="p-4 rounded-xl border border-stone-100 space-y-3 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-stone-400">卡片 {i + 1}</span>
                <select
                  value={f.icon}
                  onChange={(e) => updateFeature(i, "icon", e.target.value)}
                  className="text-[12px] px-2 py-1 rounded-lg border border-stone-200 bg-white text-stone-600 outline-none"
                >
                  <option value="Gauge">Gauge</option>
                  <option value="ImageIcon">ImageIcon</option>
                  <option value="MessageSquare">MessageSquare</option>
                  <option value="FileText">FileText</option>
                  <option value="Zap">Zap</option>
                  <option value="Users">Users</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeFeature(i)}
                className="shrink-0 w-7 h-7 rounded-lg border border-red-200/60 text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
                title="删除卡片"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={f.title}
              onChange={(e) => updateFeature(i, "title", e.target.value)}
              placeholder="标题"
              className="w-full px-3 py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[14px] outline-none focus:border-stone-300 transition-colors"
            />
            <textarea
              value={f.desc}
              onChange={(e) => updateFeature(i, "desc", e.target.value)}
              rows={2}
              placeholder="描述"
              className="w-full px-3 py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[14px] outline-none focus:border-stone-300 transition-colors resize-none"
            />
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[14px] font-medium bg-[#D97757] text-white hover:bg-[#C5694A] disabled:bg-stone-200 disabled:text-stone-400 transition-all duration-200"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />保存中…</> : "保存配置"}
      </button>

      {toast && (
        <div className="fixed bottom-8 right-8 z-50 animate-[fadeInUp_0.3s_ease-out]">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-white border border-stone-200/60 rounded-xl shadow-lg">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-emerald-600" />
            </div>
            <span className="text-[14px] text-stone-700 font-medium">内容已更新，刷新首页即可查看</span>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
