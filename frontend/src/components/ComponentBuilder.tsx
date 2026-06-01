"use client";

import { useState } from "react";
import { X, Eye, Code, Plus, MousePointerClick, BookOpen } from "lucide-react";
import { COMPONENT_REGISTRY, type ComponentMeta } from "@/lib/wechat-components";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MousePointerClick,
  BookOpen,
};

export function ComponentBuilder({ onInsert }: { onInsert: (html: string, label: string, position: "top" | "bottom") => void }) {
  const [selected, setSelected] = useState<ComponentMeta | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"preview" | "code">("preview");

  const select = (meta: ComponentMeta) => {
    setSelected(meta);
    const init: Record<string, string> = {};
    meta.fields.forEach((f) => (init[f.name] = ""));
    setFormData(init);
    setMode("preview");
  };

  const close = () => setSelected(null);

  const handleInsert = () => {
    if (!selected) return;
    const html = selected.generateHTML(formData);
    const position = (formData.position as "top" | "bottom") || "bottom";
    onInsert(html, selected.label, position);
    close();
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-stone-500">微信排版组件</label>

      {/* component cards — always visible */}
      <div className="grid grid-cols-2 gap-2">
        {COMPONENT_REGISTRY.map((c) => {
          const Icon = iconMap[c.icon];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => select(c)}
              className="text-left p-3 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon className="w-4 h-4 text-neutral-500" />}
                <p className="text-[13px] font-medium text-neutral-800">{c.label}</p>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">{c.description}</p>
            </button>
          );
        })}
      </div>

      {/* config modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-stone-200/60 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2">
                {(() => { const I = iconMap[selected.icon]; return I ? <I className="w-4 h-4 text-neutral-500" /> : null; })()}
                <h3 className="text-[15px] font-semibold text-stone-800">{selected.label}</h3>
              </div>
              <button onClick={close} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {selected.fields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <label className="text-[13px] font-medium text-stone-500">{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={formData[f.name] || ""}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      placeholder={f.placeholder}
                      rows={5}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[13px] outline-none focus:border-stone-300 resize-none"
                    />
                  ) : f.type === "select" ? (
                    <select
                      value={formData[f.name] || ""}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[13px] outline-none focus:border-stone-300"
                    >
                      <option value="">请选择</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData[f.name] || ""}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200/60 bg-stone-50 text-[13px] outline-none focus:border-stone-300"
                    />
                  )}
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("preview")}
                  className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                    mode === "preview" ? "border-stone-300 bg-stone-100 text-stone-700" : "border-stone-200/60 text-stone-400"
                  }`}
                >
                  <Eye className="w-3 h-3" />预览
                </button>
                <button
                  type="button"
                  onClick={() => setMode("code")}
                  className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                    mode === "code" ? "border-stone-300 bg-stone-100 text-stone-700" : "border-stone-200/60 text-stone-400"
                  }`}
                >
                  <Code className="w-3 h-3" />源码
                </button>
              </div>

              <div className="rounded-xl border border-stone-200/60 bg-stone-50 p-4 min-h-[80px] overflow-auto">
                {mode === "preview" ? (
                  selected.generatePreview(formData)
                ) : (
                  <pre className="text-[11px] text-stone-500 font-mono whitespace-pre-wrap break-all">
                    {selected.generateHTML(formData)}
                  </pre>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-stone-100 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg text-[13px] text-stone-500 hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleInsert}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97757] text-white text-[13px] font-medium hover:bg-[#C5694A] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                插入到文章
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
