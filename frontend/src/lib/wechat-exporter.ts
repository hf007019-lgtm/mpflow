/* ───── WeChat Official Account HTML Exporter ───── */

import type { StylePreset } from "./style-presets";

/**
 * Convert a CSS-like object to an inline style string.
 */
function toStyleString(rules: Record<string, string>): string {
  return Object.entries(rules)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`)
    .join("; ");
}

/**
 * Convert a rendered Markdown DOM tree to WeChat-safe HTML with inline styles.
 *
 * WeChat's editor strips class names, external stylesheets, and many HTML
 * attributes. This function walks the DOM and injects inline `style` attributes
 * based on the selected preset, then returns a clean HTML string.
 */
export function exportToWechatHTML(
  container: HTMLElement,
  preset: StylePreset,
): string {
  const clone = container.cloneNode(true) as HTMLElement;

  // Apply body-level styles to the wrapper
  const wrapper = document.createElement("div");
  wrapper.setAttribute("style", toStyleString(preset.body));

  // Walk every child node
  applyInlineStyles(clone, preset);

  // Move children into wrapper
  while (clone.firstChild) {
    wrapper.appendChild(clone.firstChild);
  }

  return wrapper.outerHTML;
}

function applyInlineStyles(el: Element, preset: StylePreset) {
  const tag = el.tagName.toLowerCase();

  const tagMap: Record<string, Record<string, string>> = {
    h1: preset.h1,
    h2: preset.h2,
    p: preset.p,
    blockquote: preset.blockquote,
    strong: preset.strong,
    b: preset.strong,
    hr: preset.hr,
    a: preset.a,
    img: preset.img,
  };

  // Apply tag-specific styles
  if (tagMap[tag]) {
    const existing = el.getAttribute("style") || "";
    el.setAttribute("style", existing + ";" + toStyleString(tagMap[tag]));
  }

  // ───── WeChat-specific fixes ─────

  // Images: remove inline margin that causes gaps, use block display
  if (tag === "img") {
    el.setAttribute("width", "100%");
    // Fix WeChat's famous "image bottom gap" issue
    const s = el.getAttribute("style") || "";
    el.setAttribute("style", s + ";display:block;margin:12px auto;vertical-align:bottom");
  }

  // Tables: constrain width to prevent overflow
  if (tag === "table") {
    el.setAttribute("width", "100%");
    const s = el.getAttribute("style") || "";
    el.setAttribute("style", s + ";max-width:100%;table-layout:fixed;word-break:break-all;border-collapse:collapse");
  }

  // Pre/code blocks: wrap long lines
  if (tag === "pre" || tag === "code") {
    const s = el.getAttribute("style") || "";
    el.setAttribute("style", s + ";white-space:pre-wrap;word-break:break-all;max-width:100%;overflow-x:auto");
  }

  // Iframe / video: constrain width
  if (tag === "iframe" || tag === "video") {
    el.setAttribute("width", "100%");
    const s = el.getAttribute("style") || "";
    el.setAttribute("style", s + ";max-width:100%");
  }

  // Recurse
  for (let i = 0; i < el.children.length; i++) {
    applyInlineStyles(el.children[i], preset);
  }
}

/**
 * Copy WeChat-safe HTML to clipboard using the Clipboard API.
 * Falls back to plain text copy if HTML clipboard isn't supported.
 */
export async function copyWechatHTML(container: HTMLElement, preset: StylePreset): Promise<boolean> {
  const html = exportToWechatHTML(container, preset);
  const plain = container.textContent || "";

  try {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    // Fallback
    await navigator.clipboard.writeText(plain);
    return false;
  }
}
