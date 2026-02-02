// GPT-Booster v5.2 ultra-passive — ChatGPT output aware (standalone, body observer)

const DEBUG = false;
const OBS_CONFIG = { childList: true, subtree: true };
const SELECTORS = {
  assistant: '[data-message-author-role="assistant"]',
  rootFallback: '[role="article"]',
  turns: '[data-message-author-role]'
};
const STABLE_TEXT_MS = 900;

let lastScrollTop = null;
let activeAssistant = null;
let lastAssistantText = "";
let lastAssistantChange = 0;
let scrollClampEnabled = false;
let mutationDebounceTimer = null;
let finalizeTimer = null;

window.__GPT_BOOSTER_NEW__ = true;

function isThinking(root) {
  if (!root) return false;
  const testId = root.getAttribute("data-testid") || "";
  if (/thinking|generating|streaming/i.test(testId)) return true;
  const className = typeof root.className === "string" ? root.className : "";
  if (/thinking|generating|streaming/i.test(className)) return true;
  const thinkingNode = root.querySelector(
    '[data-testid*="thinking"], [data-testid*="generating"], [data-testid*="streaming"], .thinking, .generating, .streaming'
  );
  return Boolean(thinkingNode);
}

function hasStreamingCursor(root) {
  if (!root) return false;
  return Boolean(
    root.querySelector(
      '[data-testid="cursor"], [data-testid*="cursor"], .cursor, .result-streaming, .typing, [class*="streaming"]'
    )
  );
}

function getLatestAssistant() {
  const assistants = document.querySelectorAll(SELECTORS.assistant);
  if (assistants.length) return assistants[assistants.length - 1];
  const fallbackNodes = document.querySelectorAll(SELECTORS.rootFallback);
  return fallbackNodes[fallbackNodes.length - 1] || null;
}

function annotateTurns() {
  const turns = document.querySelectorAll(SELECTORS.turns);
  turns.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const role = (node.getAttribute("data-message-author-role") || "").toLowerCase();
    if (role === "user") {
      node.setAttribute("data-gpt-booster-hidden-prefix", "USER:");
      return;
    }
    if (role === "assistant") {
      node.setAttribute("data-gpt-booster-hidden-prefix", "AI:");
    }
  });
}

function markAssistantState(node) {
  const text = node ? node.textContent || "" : "";
  if (node !== activeAssistant) {
    activeAssistant = node;
    lastAssistantText = text;
    lastAssistantChange = Date.now();
    return false;
  }
  if (text !== lastAssistantText) {
    lastAssistantText = text;
    lastAssistantChange = Date.now();
    return false;
  }
  return true;
}

function enableClamp() {
  if (scrollClampEnabled) return;
  window.addEventListener("scroll", clampScroll, { passive: true });
  scrollClampEnabled = true;
}

function disableClamp() {
  if (!scrollClampEnabled) return;
  window.removeEventListener("scroll", clampScroll, { passive: true });
  scrollClampEnabled = false;
}

function scheduleFinalizeCheck() {
  if (finalizeTimer) return;
  finalizeTimer = setTimeout(() => {
    finalizeTimer = null;
    handleMutations();
  }, STABLE_TEXT_MS);
}

function handleMutations() {
  if (mutationDebounceTimer) {
    clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = null;
  }
  const latest = getLatestAssistant();
  annotateTurns();
  if (!latest) return;

  if (isThinking(latest)) {
    disableClamp();
    scheduleFinalizeCheck();
    return;
  }

  const stableText = markAssistantState(latest);
  const streaming = hasStreamingCursor(latest);
  const sinceChange = Date.now() - lastAssistantChange;
  const isStable = stableText && !streaming && sinceChange >= STABLE_TEXT_MS;

  if (isStable) {
    enableClamp();
  } else {
    scheduleFinalizeCheck();
  }
}

function scheduleMutationHandling() {
  if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
  mutationDebounceTimer = setTimeout(handleMutations, 150);
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
  if (!document.body) return;
  const observer = new MutationObserver(scheduleMutationHandling);
  observer.observe(document.body, OBS_CONFIG);
  annotateTurns();
  handleMutations();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
