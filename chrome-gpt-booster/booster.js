// GPT-Booster v5.2 ultra-passive — ChatGPT 5.2 (standalone, single attach)

const DEBUG = false;
const OBS_CONFIG = { childList: true, subtree: false };
const SELECTORS = {
  root: "article[data-testid^='conversation-turn']:last-of-type",
  rootFallback: "article"
};
const MAX_ROOT_CHARS = 12000;
const MAX_ROOT_ATTACH_TRIES = 3;

let lastScrollTop = null;
let activeRoot = null;
let activeObserver = null;
let rootCheckTimer = null;
let thinkingMode = false;
let scrollClampEnabled = false;
const rootAttachAttempts = new WeakMap();

const safeIdle = (cb, delay = 1200) => {
  if (typeof requestIdleCallback === "function") {
    return requestIdleCallback(cb, { timeout: delay });
  }
  return setTimeout(cb, delay);
};

function isThinking(root) {
  if (!root) return false;
  const testId = root.getAttribute("data-testid") || "";
  if (/thinking|generating|streaming/i.test(testId)) return true;
  const className = typeof root.className === "string" ? root.className : "";
  if (/thinking|generating|streaming/i.test(className)) return true;
  const thinkingNode = root.querySelector(
    '[data-testid*="thinking"], [data-testid*="generating"], .thinking, .generating, .streaming'
  );
  return Boolean(thinkingNode);
}

function hasAssistantToken(root) {
  if (!root) return false;
  return Boolean(root.querySelector('[data-message-author-role="assistant"]'));
}

function getLatestRoot() {
  const preferred = document.querySelector(SELECTORS.root);
  if (preferred) return preferred;
  const fallbackNodes = document.querySelectorAll(SELECTORS.rootFallback);
  return fallbackNodes[fallbackNodes.length - 1] || null;
}

function getAttachAttempts(root) {
  return rootAttachAttempts.get(root) || 0;
}

function bumpAttachAttempts(root) {
  const next = getAttachAttempts(root) + 1;
  rootAttachAttempts.set(root, next);
  return next;
}

function setActiveRoot(root) {
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
  activeRoot = root;
}

function attachObserver(root) {
  const rootChars = (root.textContent || "").length;
  if (rootChars > MAX_ROOT_CHARS) {
    rootAttachAttempts.set(root, MAX_ROOT_ATTACH_TRIES);
    return;
  }
  activeObserver = new MutationObserver(() => {});
  activeObserver.observe(root, OBS_CONFIG);
}

function scheduleRootCheck(delay = 1200) {
  if (rootCheckTimer) return;
  rootCheckTimer = safeIdle(() => {
    rootCheckTimer = null;
    checkRoot();
  }, delay);
}

function attemptAttach(root) {
  if (!root) {
    scheduleRootCheck(1200);
    return;
  }
  if (root !== activeRoot) {
    setActiveRoot(root);
  }
  if (isThinking(root)) {
    thinkingMode = true;
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    if (scrollClampEnabled) {
      window.removeEventListener("scroll", clampScroll, { passive: true });
      scrollClampEnabled = false;
    }
    return;
  }
  if (activeObserver) {
    const rootChars = (root.textContent || "").length;
    if (rootChars > MAX_ROOT_CHARS) {
      activeObserver.disconnect();
      activeObserver = null;
      rootAttachAttempts.set(root, MAX_ROOT_ATTACH_TRIES);
    }
    return;
  }
  const attempts = getAttachAttempts(root);
  if (attempts >= MAX_ROOT_ATTACH_TRIES) return;
  if (!hasAssistantToken(root)) {
    bumpAttachAttempts(root);
    scheduleRootCheck(1200);
    return;
  }
  if (!scrollClampEnabled) {
    window.addEventListener("scroll", clampScroll, { passive: true });
    scrollClampEnabled = true;
  }
  attachObserver(root);
}

function checkRoot() {
  if (thinkingMode) return;
  const latest = getLatestRoot();
  if (!latest) {
    scheduleRootCheck(1200);
    return;
  }
  attemptAttach(latest);
  if (!thinkingMode) scheduleRootCheck(1200);
}

function clampScroll() {
  const scroller = document.scrollingElement || document.documentElement;
  if (!scroller) return;
  const current = scroller.scrollTop;
  if (lastScrollTop === null) {
    lastScrollTop = current;
    return;
  }
  const delta = current - lastScrollTop;
  if (delta < -800) {
    scroller.scrollTop = lastScrollTop - 800;
    lastScrollTop = scroller.scrollTop;
    return;
  }
  lastScrollTop = current;
}

function start() {
  scheduleRootCheck(0);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
