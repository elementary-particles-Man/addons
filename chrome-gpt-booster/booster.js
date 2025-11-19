// GPT Booster 3.1 — A/B mode + Thinking detection (closed-shadow safe)
(() => {
  const VERSION = '3.1';
  console.log(`[GPT-Booster] active v${VERSION}`);

  let mode = 'B';
  let observer = null;
  let lastScroll = 0;

  chrome.storage.sync.get(['boosterMode'], ({ boosterMode }) => {
    mode = boosterMode || 'B';
    console.log(`[GPT-Booster] Mode=${mode}`);
    init();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'mode-switch') {
      mode = msg.mode;
      console.log(`[GPT-Booster] Runtime switch → ${mode}`);
      resetObserver();
      init();
    }
  });

  function resetObserver() {
    if (observer) observer.disconnect();
    observer = null;
  }

  /* ------------------------------ */
  /*  Reflow Optimization           */
  /* ------------------------------ */
  function optimizeReflowSafe() {
    const s = document.createElement('style');
    s.textContent = `
      .markdown, .prose { contain: layout style; }
      .overflow-y-auto { will-change: scroll-position; }
    `;
    document.head.appendChild(s);
  }

  function optimizeReflowAggressive() {
    const s = document.createElement('style');
    s.textContent = `
      .markdown, .prose {
        contain: layout style;
        backface-visibility: hidden;
        transform: translateZ(0);
      }
      .overflow-y-auto { will-change: scroll-position; }
      article { transform: translateZ(0); }
    `;
    document.head.appendChild(s);
  }

  /* ------------------------------ */
  /*  Thinking Detection (shadow safe)  */
  /* ------------------------------ */
  function thinkingPulse() {
    function tick() {
      const area = document.querySelector('.overflow-y-auto');
      if (area) {
        const h = area.scrollHeight;
        if (Math.abs(h - lastScroll) > 2) {
          console.debug('[GPT-Booster] Thinking pulse detected');
        }
        lastScroll = h;
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  function thinkingBadgeDetector() {
    const sel = '[data-message-author-role="assistant"] [data-testid="thinking"]';
    setInterval(() => {
      const node = document.querySelector(sel);
      if (!node) return;
      const s = window.getComputedStyle(node);
      if (s.opacity !== '0') {
        console.debug('[GPT-Booster] Thinking badge active');
      }
    }, 300);
  }

  /* ------------------------------ */
  /*  DOM Observer (answer-phase)   */
  /* ------------------------------ */
  function attachObserver(mode) {
    const root = document.querySelector('#thread');
    if (!root) return setTimeout(() => attachObserver(mode), 800);

    const selectors = [
      'article .markdown.prose',
      'div.flex.max-w-full.flex-col.grow > div > div > div'
    ];

    const delay = mode === 'A' ? 200 : 500;

    observer = new MutationObserver(throttle(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const sel = selectors.find(s => n.matches?.(s) || n.querySelector?.(s));
          if (!sel) continue;
          console.debug(`[GPT-Booster] Update (mode=${mode})`);
        }
      }
    }, delay));

    observer.observe(root, { childList: true, subtree: true });
    console.log(`[GPT-Booster] DOM observer attached (mode=${mode})`);
  }

  function throttle(fn, delay) {
    let t = 0;
    return (...args) => {
      const now = Date.now();
      if (now - t >= delay) {
        t = now;
        fn(...args);
      }
    };
  }

  /* ------------------------------ */
  /*  Init                         */
  /* ------------------------------ */
  function init() {
    if (mode === 'A') optimizeReflowAggressive();
    else optimizeReflowSafe();

    attachObserver(mode);
    thinkingPulse();
    thinkingBadgeDetector();

    console.log(`[GPT-Booster] Initialized mode=${mode}`);
  }
})();
