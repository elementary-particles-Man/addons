// shared/selector.js v1.0 (capture)
// ChatGPT UI の DOM 変化に強く、Thinking/通常の両方を確実に捕捉する selector resolver

export function detectTargetRoot() {
  const candidates = [
    // 通常モード（スレッド本体）
    "#thread",
    "#__next main .flex-col.grow",
    "main div.flex-col.grow",

    // Thinking モード（article が shadow/仮想 DOM 化）
    "#__next main div.relative.basis-auto.flex-col",
    "#__next main div.thread-xl\\:pt-header-height",
    "div.thread-xl\\:pt-header-height",

    // 最終フォールバック
    "#__next",
    "main",
    "body"
  ];

  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  return null;
}
