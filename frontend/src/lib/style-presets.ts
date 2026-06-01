/* ───── MPFlow Style Presets ───── */

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  // WeChat-safe inline CSS
  body: Record<string, string>;
  h1: Record<string, string>;
  h2: Record<string, string>;
  p: Record<string, string>;
  blockquote: Record<string, string>;
  strong: Record<string, string>;
  hr: Record<string, string>;
  a: Record<string, string>;
  img: Record<string, string>;
}

export const PRESETS: StylePreset[] = [
  {
    id: "classic",
    name: "经典杂志",
    description: "适合深度长文，字大行疏",
    body: {
      fontFamily: "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
      fontSize: "16px",
      lineHeight: "1.85",
      color: "#333",
      letterSpacing: "0.5px",
    },
    h1: { fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginTop: "24px", marginBottom: "12px", textAlign: "center" as const },
    h2: { fontSize: "18px", fontWeight: "700", color: "#333", marginTop: "20px", marginBottom: "10px", paddingLeft: "8px", borderLeft: "3px solid #d97757" },
    p: { marginBottom: "16px", textAlign: "justify" as const },
    blockquote: { borderLeft: "3px solid #e5e5e5", paddingLeft: "12px", color: "#888", marginTop: "16px", marginBottom: "16px" },
    strong: { color: "#d97757", fontWeight: "700" },
    hr: { border: "none", borderTop: "1px solid #eee", margin: "24px 0" },
    a: { color: "#576b95", textDecoration: "none" },
    img: { maxWidth: "100%", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", display: "block" },
  },
  {
    id: "minimal",
    name: "极简日系",
    description: "留白多，阅读轻松",
    body: {
      fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Sans GB','Microsoft YaHei',sans-serif",
      fontSize: "15px",
      lineHeight: "2.0",
      color: "#444",
      letterSpacing: "1px",
    },
    h1: { fontSize: "20px", fontWeight: "600", color: "#2c2c2c", marginTop: "32px", marginBottom: "16px" },
    h2: { fontSize: "17px", fontWeight: "600", color: "#555", marginTop: "28px", marginBottom: "14px" },
    p: { marginBottom: "20px", textAlign: "justify" as const },
    blockquote: { borderLeft: "2px solid #d0d0d0", paddingLeft: "14px", color: "#999", marginTop: "20px", marginBottom: "20px", fontStyle: "italic" },
    strong: { color: "#2c2c2c", fontWeight: "700" },
    hr: { border: "none", height: "1px", background: "linear-gradient(to right,transparent,#ddd,transparent)", margin: "32px 0" },
    a: { color: "#576b95", textDecoration: "none", borderBottom: "1px solid #576b95" },
    img: { maxWidth: "100%", borderRadius: "4px", marginTop: "16px", marginBottom: "16px", display: "block" },
  },
  {
    id: "dark",
    name: "暗夜阅读",
    description: "深色底白字，适合夜间推送",
    body: {
      fontFamily: "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
      fontSize: "16px",
      lineHeight: "1.9",
      color: "#ddd",
      letterSpacing: "0.5px",
      backgroundColor: "#1a1a2e",
      padding: "24px 16px",
    },
    h1: { fontSize: "22px", fontWeight: "700", color: "#fff", marginTop: "24px", marginBottom: "12px" },
    h2: { fontSize: "18px", fontWeight: "700", color: "#eee", marginTop: "20px", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #333" },
    p: { marginBottom: "14px" },
    blockquote: { borderLeft: "3px solid #444", paddingLeft: "12px", color: "#aaa", marginTop: "16px", marginBottom: "16px" },
    strong: { color: "#ffa07a", fontWeight: "700" },
    hr: { border: "none", borderTop: "1px solid #333", margin: "24px 0" },
    a: { color: "#7ec8e3", textDecoration: "none" },
    img: { maxWidth: "100%", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", display: "block" },
  },
  {
    id: "warm",
    name: "暖调生活",
    description: "温馨柔和，适合情感/生活类",
    body: {
      fontFamily: "-apple-system,BlinkMacSystemFont,'PingFang SC','STSong','Microsoft YaHei',serif",
      fontSize: "16px",
      lineHeight: "2.0",
      color: "#5c4a3d",
      letterSpacing: "0.8px",
    },
    h1: { fontSize: "22px", fontWeight: "600", color: "#4a3728", marginTop: "26px", marginBottom: "14px" },
    h2: { fontSize: "18px", fontWeight: "600", color: "#6b5645", marginTop: "22px", marginBottom: "12px" },
    p: { marginBottom: "18px" },
    blockquote: { borderLeft: "3px solid #d4a574", paddingLeft: "14px", color: "#8b7355", marginTop: "18px", marginBottom: "18px" },
    strong: { color: "#b87333", fontWeight: "700" },
    hr: { border: "none", borderTop: "1px dashed #d4a574", margin: "28px 0" },
    a: { color: "#8b6914", textDecoration: "none" },
    img: { maxWidth: "100%", borderRadius: "12px", marginTop: "14px", marginBottom: "14px", display: "block", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  },
];

export function getPreset(id: string): StylePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
