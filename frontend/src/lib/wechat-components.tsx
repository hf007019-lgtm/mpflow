/* ───────────────────────────────────────────────────────────
 * MPFlow 微信排版组件库
 * ─────────────────────────────────────────────────────────── */

import React from "react";

/* ═══════════════════════════════════════════════════════════
 * 关注引导组件
 * ═══════════════════════════════════════════════════════════ */

export interface FollowBannerConfig {
  logoUrl: string;
  brandName: string;
  wechatId: string;
  position: "top" | "bottom";
}

export function FollowBannerHTML(cfg: FollowBannerConfig): string {
  const isBottom = cfg.position === "bottom";

  if (isBottom) {
    // ── 底部引导（文章结尾，带二维码占位）──
    return `
<div style="margin-top:40px;text-align:center;padding:24px 16px;
  background:#f8f8f8;border-radius:12px;">
  <img src="${cfg.logoUrl}" alt="" style="
    width:56px;height:56px;border-radius:50%;display:block;
    margin:0 auto 10px;border:2px solid #eee;
  " />
  <p style="font-size:16px;font-weight:700;color:#333;margin:0 0 4px;">${cfg.brandName}</p>
  <p style="font-size:12px;color:#999;margin:0 0 8px;">微信号: ${cfg.wechatId}</p>
  <p style="font-size:13px;color:#666;margin:0 0 14px;line-height:1.6;">
    长按识别二维码<br />关注我们，获取更多深度内容
  </p>
  <span style="
    display:inline-block;padding:8px 28px;
    background:#07c160;color:#fff;
    border-radius:24px;font-size:14px;font-weight:600;
  ">点击关注</span>
</div>`;
  }

  // ── 顶部引导（标题上方，紧凑横排）──
  return `
<div style="margin-bottom:20px;padding:12px 14px;
  background:linear-gradient(135deg,#f8f8f8,#fff);
  border-radius:10px;display:flex;align-items:center;gap:10px;">
  <img src="${cfg.logoUrl}" alt="" style="
    width:44px;height:44px;border-radius:50%;flex-shrink:0;
    border:1.5px solid #eee;display:block;
  " />
  <div style="flex:1;min-width:0;">
    <p style="font-size:14px;font-weight:700;color:#333;margin:0 0 2px;">${cfg.brandName}</p>
    <p style="font-size:11px;color:#999;margin:0;">微信号: ${cfg.wechatId}</p>
  </div>
  <span style="
    flex-shrink:0;padding:6px 16px;
    background:#07c160;color:#fff;
    border-radius:16px;font-size:12px;font-weight:600;
  ">关注</span>
</div>`;
}

/* ═══════════════════════════════════════════════════════════
 * 往期推荐组件
 * ═══════════════════════════════════════════════════════════ */

export interface RecommendCard {
  image: string;
  title: string;
  url: string;
  reads?: string;
}

export function RecommendCardsHTML(cards: RecommendCard[]): string {
  if (!cards.length) return "";

  const items = cards
    .map(
      (c, i) => `
    <a href="${c.url}" style="
      display:flex;gap:12px;padding:12px 0;
      border-bottom:${i < cards.length - 1 ? "1px solid #f0f0f0" : "none"};
      text-decoration:none;color:inherit;align-items:center;
    ">
      <img src="${c.image}" alt="" style="
        width:80px;height:60px;border-radius:6px;object-fit:cover;
        flex-shrink:0;display:block;
      " />
      <div style="flex:1;min-width:0;">
        <p style="font-size:14px;font-weight:500;color:#333;margin:0 0 6px;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
          overflow:hidden;line-height:1.5;
        ">${c.title}</p>
        ${c.reads ? `<span style="font-size:11px;color:#999;">${c.reads}</span>` : ""}
      </div>
    </a>`,
    )
    .join("");

  return `
<div style="margin-top:32px;padding:16px;background:#fafafa;border-radius:12px;">
  <p style="
    font-size:13px;font-weight:600;color:#999;margin:0 0 8px;
    display:flex;align-items:center;gap:6px;
  ">📖 往期推荐</p>
  ${items}
</div>`;
}

/* ═══════════════════════════════════════════════════════════
 * 组件元数据（供编辑器表单使用）
 * ═══════════════════════════════════════════════════════════ */

export interface ComponentMeta {
  key: string;
  label: string;
  icon: string; // Lucide icon name
  description: string;
  fields: {
    name: string;
    label: string;
    type: "text" | "url" | "textarea" | "select";
    placeholder?: string;
    options?: { label: string; value: string }[];
  }[];
  generateHTML: (data: Record<string, string>) => string;
  generatePreview: (data: Record<string, string>) => React.ReactNode;
}

export const COMPONENT_REGISTRY: ComponentMeta[] = [
  {
    key: "followBanner",
    label: "关注引导",
    icon: "MousePointerClick",
    description: "公众号 Logo + 名称 + 微信号引导关注",
    fields: [
      { name: "logoUrl", label: "Logo 图片 URL", type: "url", placeholder: "https://example.com/logo.png" },
      { name: "brandName", label: "品牌名称", type: "text", placeholder: "MPFlow" },
      { name: "wechatId", label: "微信号", type: "text", placeholder: "mpflow2026" },
      { name: "position", label: "插入位置", type: "select", options: [
        { label: "顶部（标题下方，紧凑横排）", value: "top" },
        { label: "底部（文章结尾，含二维码引导）", value: "bottom" },
      ]},
    ],
    generateHTML: (d) => FollowBannerHTML({
      logoUrl: d.logoUrl || "",
      brandName: d.brandName || "MPFlow",
      wechatId: d.wechatId || "",
      position: (d.position as "top" | "bottom") || "top",
    }),
    generatePreview: (d) => {
      const pos = d.position === "bottom";
      return (
        <div className={pos ? "text-center p-4 bg-gray-50 rounded-lg" : "flex items-center gap-2 p-2 bg-gray-50 rounded-lg"}>
          <div className={`${pos ? "w-10 h-10" : "w-8 h-8"} rounded-full bg-gray-200 mx-auto shrink-0`} />
          <div className="flex-1 min-w-0 text-center">
            <p className="text-xs font-bold">{d.brandName || "MPFlow"}</p>
            {d.wechatId && <p className="text-[10px] text-gray-400">微信号: {d.wechatId}</p>}
          </div>
          <span className="text-[10px] px-2 py-0.5 bg-green-500 text-white rounded-full shrink-0">关注</span>
        </div>
      );
    },
  },
  {
    key: "recommendCards",
    label: "往期推荐",
    icon: "BookOpen",
    description: "图文卡片列表，整卡可点击跳转",
    fields: [
      { name: "cards", label: "推荐文章列表", type: "textarea",
        placeholder: `[\n  {"image": "https://...", "title": "文章标题一", "url": "https://...", "reads": "1.2万阅读"},\n  {"image": "https://...", "title": "文章标题二", "url": "https://..."}\n]` },
    ],
    generateHTML: (d) => {
      try {
        const cards = JSON.parse(d.cards || "[]");
        return RecommendCardsHTML(Array.isArray(cards) ? cards : []);
      } catch { return "<p>JSON 格式错误，请检查</p>"; }
    },
    generatePreview: (d) => {
      let cards: RecommendCard[] = [];
      try { cards = JSON.parse(d.cards || "[]"); } catch { /* */ }
      if (!cards.length) return <p className="text-xs text-gray-400">请填写 JSON 卡片数据</p>;
      return (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] font-medium text-gray-400 mb-2">📖 往期推荐</p>
          {cards.slice(0, 3).map((c, i) => (
            <div key={i} className="flex gap-2 py-2 border-b border-gray-100 last:border-0 items-center">
              <div className="w-10 h-8 rounded bg-gray-200 shrink-0" />
              <p className="text-[11px] text-gray-600 truncate flex-1">{c.title}</p>
            </div>
          ))}
        </div>
      );
    },
  },
];

/* ───── 快捷插入片段 ───── */
export const COMPONENT_SNIPPETS: Record<string, { label: string; insert: string }> = {
  followTop: {
    label: "顶部关注引导",
    insert: ':::follow logoUrl="https://..." brandName="MPFlow" wechatId="mpflow2026" position="top" :::',
  },
  followBottom: {
    label: "底部关注引导",
    insert: ':::follow logoUrl="https://..." brandName="MPFlow" wechatId="mpflow2026" position="bottom" :::',
  },
  recommend: {
    label: "往期推荐",
    insert: ':::recommend [{"image":"url","title":"标题","url":"https://...","reads":"1.2万阅读"}] :::',
  },
};
