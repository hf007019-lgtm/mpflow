"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
} from "lucide-react";

const models = [
  { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash (极速便宜)" },
  { value: "deepseek-chat", label: "DeepSeek V3" },
  { value: "deepseek-reasoner", label: "DeepSeek R1 (推理)" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-3-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "qwen-max", label: "通义千问 Max" },
];

export default function AdminSettingsPage() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [multiplier, setMultiplier] = useState(1.0);
  const [priceBase, setPriceBase] = useState(1);
  const [priceImage, setPriceImage] = useState(5);
  const [priceDesc, setPriceDesc] = useState(1);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.apiBaseUrl) setApiUrl(data.apiBaseUrl);
        if (data.model) setModel(data.model);
        if (data.multiplier !== undefined) setMultiplier(data.multiplier);
        if (data.price_base_500_words !== undefined) setPriceBase(data.price_base_500_words);
        if (data.price_auto_image !== undefined) setPriceImage(data.price_auto_image);
        if (data.price_image_desc !== undefined) setPriceDesc(data.price_image_desc);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string | number> = { apiBaseUrl: apiUrl, model, multiplier, price_base_500_words: priceBase, price_auto_image: priceImage, price_image_desc: priceDesc };
      if (apiKey.trim()) {
        body.apiKey = apiKey.trim();
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Save failed");

      setApiKey("");
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        {loading ? (
          <div className="bg-white rounded-xl border border-stone-200/60 p-6 space-y-5 animate-pulse">
            <div className="h-5 bg-stone-100 rounded w-24" />
            <div className="h-10 bg-stone-50 rounded-xl" />
            <div className="h-5 bg-stone-100 rounded w-16" />
            <div className="h-10 bg-stone-50 rounded-xl" />
            <div className="h-5 bg-stone-100 rounded w-28" />
            <div className="h-10 bg-stone-50 rounded-xl" />
          </div>
        ) : (
        <div className="bg-white rounded-xl border border-stone-200/60 p-6 space-y-6">
          {/* API Base URL */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-stone-700">
              API Base URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.openai.com"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200/60 bg-stone-50 text-[14px] text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-stone-700">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="留空则不修改，输入新 Key 将覆盖旧值"
                className="w-full px-4 py-2.5 pr-11 rounded-xl border border-stone-200/60 bg-stone-50 text-[14px] text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Model Select */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-stone-700">
              默认生成模型
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200/60 bg-stone-50 text-[14px] text-stone-800 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23a8a29e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
                paddingRight: "2.5rem",
              }}
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Billing Multiplier (deprecated) */}
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-stone-700">
              计费倍率 (已弃用)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMultiplier(Math.max(0.1, +(multiplier - 0.1).toFixed(1)))}
                className="w-9 h-9 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-lg"
              >-</button>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={multiplier}
                onChange={(e) => setMultiplier(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-20 text-center px-2 py-2.5 rounded-xl border border-stone-200/60 bg-stone-50 text-[14px] font-mono font-semibold text-stone-800 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setMultiplier(+(multiplier + 0.1).toFixed(1))}
                className="w-9 h-9 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-lg"
              >+</button>
              <span className="text-xs text-stone-400 ml-1">
                (已弃用 — 系统现已使用积分制计费)
              </span>
            </div>
          </div>

          {/* Pricing Rules */}
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <div>
              <h3 className="text-[15px] font-semibold text-stone-800">计费规则配置</h3>
              <p className="text-[12px] text-stone-400 mt-0.5">公式：基础字数 ÷ 500 × 单价 + 配图附加 + 图片描述附加</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-stone-500">基础单价 (每 500 字)</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPriceBase(Math.max(0, priceBase - 1))}
                    className="w-8 h-8 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-sm"
                  >-</button>
                  <input
                    type="number"
                    min="0"
                    value={priceBase}
                    onChange={(e) => setPriceBase(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 text-center py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[14px] font-mono font-semibold text-stone-800 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setPriceBase(priceBase + 1)}
                    className="w-8 h-8 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-sm"
                  >+</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-stone-500">自动配图附加</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPriceImage(Math.max(0, priceImage - 1))}
                    className="w-8 h-8 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-sm"
                  >-</button>
                  <input
                    type="number"
                    min="0"
                    value={priceImage}
                    onChange={(e) => setPriceImage(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 text-center py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[14px] font-mono font-semibold text-stone-800 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setPriceImage(priceImage + 1)}
                    className="w-8 h-8 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-sm"
                  >+</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-stone-500">图片描述附加</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPriceDesc(Math.max(0, priceDesc - 1))}
                    className="w-8 h-8 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-sm"
                  >-</button>
                  <input
                    type="number"
                    min="0"
                    value={priceDesc}
                    onChange={(e) => setPriceDesc(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 text-center py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[14px] font-mono font-semibold text-stone-800 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setPriceDesc(priceDesc + 1)}
                    className="w-8 h-8 rounded-lg border border-stone-200/60 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors flex items-center justify-center text-sm"
                  >+</button>
                </div>
              </div>
            </div>

            <p className="text-[12px] text-stone-400">
              示例：500 字文章消耗 <span className="font-semibold text-stone-700">{Math.ceil(500 / 500) * priceBase}</span> 积分
              {priceImage > 0 ? <span>，配图额外 <span className="font-semibold text-stone-700">{priceImage}</span> 积分</span> : null}
            </p>
          </div>

          {/* save button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[14px] font-medium bg-[#D97757] text-white hover:bg-[#C5694A] disabled:bg-stone-200 disabled:text-stone-400 transition-all duration-200"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中…
                </>
              ) : (
                "保存配置"
              )}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-50 animate-[fadeInUp_0.3s_ease-out]">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-white border border-stone-200/60 rounded-xl shadow-lg">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-emerald-600" />
            </div>
            <span className="text-[14px] text-stone-700 font-medium">
              配置已更新
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
