// shared/selector.js
// ChatGPT v2025 UI / Thinkingモード対応版

export function detectTargetRoot() {
  const candidates = [
    "#thread",
    "main .flex-col.grow",
    "div.flex.max-w-full.flex-col.grow",
    "main div.relative.basis-auto.flex-col",
    "main div.thread-xl\\:pt-header-height",
    "#__next main",
    "#__next",
    "body"
  ];

  for (const q of candidates) {
    try {
      const el = document.querySelector(q);
      if (el) return el;
    } catch (e) {
      // ignore selector errors and continue checking
    }
  }

  return null;
}
