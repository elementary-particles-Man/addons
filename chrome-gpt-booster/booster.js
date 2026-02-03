// GPT-Booster v5.2 ultra-passive — ChatGPT output aware (standalone, body observer)

const DEBUG = false;
const OBS_CONFIG = { childList: true, subtree: true };
const TIMESTAMP_STYLE_ID = "gpt-booster-visible-timestamp-style";
const SELECTORS = {
  assistant: '[data-message-author-role="assistant"], .model-response, [data-test-id="model-response"], message-content',
  rootFallback: '[role="article"]',
  turns: '[data-message-author-role], .user-query, .model-response, [data-test-id="user-query"], [data-test-id="model-response"], user-query, message-content'
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

function ensureTimestampStyle() {
  if (document.getElementById(TIMESTAMP_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TIMESTAMP_STYLE_ID;
  style.textContent = `
    .gpt-booster-ts {
      font-size: 11px;
      line-height: 1.3;
      opacity: 0.72;
      margin: 0 0 8px 0;
      letter-spacing: 0.01em;
      user-select: none;
      pointer-events: none;
    }
    .gpt-booster-ts::before { content: attr(data-label); }
    .gpt-booster-ts-user { color: #2d6a4f; }
    .gpt-booster-ts-assistant { color: #1d3557; }
  `;
  document.head.appendChild(style);
}

function formatLocalTimestamp(ms) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date(ms));
  const map = Object.create(null);
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

function getLocalTimeZoneLabel() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch (_) {
    return "local";
  }
}

const STORAGE_PREFIX = "gpt-booster-ts";

function getStableId(node) {
  if (node.id) return node.id;
  const testId = node.getAttribute("data-testid");
  if (testId) return testId;
  const article = node.closest('article[data-testid]');
  if (article) {
    const articleTestId = article.getAttribute("data-testid");
    if (articleTestId) return articleTestId;
  }
  const childWithId = node.querySelector('[id^="user-query-content-"], [id^="message-content-id-"]');
  if (childWithId && childWithId.id) return childWithId.id;
  return null;
}

function getStorageKey(stableId) {
  // Scope by pathname to prevent collisions for generic IDs (like user-query-content-10)
  // key format: gpt-booster-ts:<pathname>:<elementId>
  const scope = window.location.pathname.replace(/\/+$/, "");
  return `${STORAGE_PREFIX}:${scope}:${stableId}`;
}

function getNodeTextFingerprint(node) {
  // Ignore booster timestamp marker itself to keep fingerprints stable.
  const cloned = node.cloneNode(true);
  if (cloned instanceof HTMLElement) {
    cloned.querySelectorAll(".gpt-booster-ts").forEach((el) => el.remove());
  }
  const text = (cloned.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, 1800);
}

function hashText(text) {
  // FNV-1a 32-bit (compact, fast, stable in plain JS).
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function getFallbackStorageKey(node, role) {
  const scope = window.location.pathname.replace(/\/+$/, "");
  const fp = getNodeTextFingerprint(node);
  if (!fp) return null;
  return `${STORAGE_PREFIX}:${scope}:fp:${role}:${hashText(fp)}`;
}

function upsertVisibleTimestamp(node, role) {
  if (!(node instanceof HTMLElement)) return;
  
  const stableId = getStableId(node);
  let ts;
  let storageKey = null;

  if (stableId) {
    storageKey = getStorageKey(stableId);
  } else {
    storageKey = getFallbackStorageKey(node, role);
  }

  if (storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        ts = Number(stored);
      }
    } catch (_) {
      // Ignore storage failures and keep DOM-only timestamp.
    }
  }

  // Fallback if not in storage or no stable ID
  if (!Number.isFinite(ts) || ts <= 0) {
    ts = Number(node.getAttribute("data-gpt-booster-ts"));
    if (!Number.isFinite(ts) || ts <= 0) {
      ts = Number(node.getAttribute("data-gpt-booster-jst-ts"));
    }
    if (!Number.isFinite(ts) || ts <= 0) {
      ts = Date.now();
    }
  }

  // Save to storage if we have a valid key
  if (storageKey) {
    try {
      localStorage.setItem(storageKey, String(ts));
    } catch (_) {
      // Storage quota or privacy mode can block writes.
    }
  }
  node.setAttribute("data-gpt-booster-ts", String(ts));

  // Double-check attribute consistency
  if (ts && node.getAttribute("data-gpt-booster-ts") !== String(ts)) {
    node.setAttribute("data-gpt-booster-ts", String(ts));
  }

  let badge = node.querySelector(":scope > .gpt-booster-ts");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "gpt-booster-ts";
    badge.setAttribute("aria-hidden", "true");
    node.prepend(badge);
  }
  const roleLabel = role === "user" ? "USER" : "AI";
  badge.className = `gpt-booster-ts gpt-booster-ts-${role}`;
  badge.setAttribute("data-label", `${roleLabel}: ${formatLocalTimestamp(ts)} ${getLocalTimeZoneLabel()}`);
}

function detectRole(node) {
  const roleAttr = node.getAttribute("data-message-author-role");
  if (roleAttr) return roleAttr.toLowerCase();
  
  const tagName = node.tagName.toLowerCase();
  const testId = node.getAttribute("data-test-id") || "";

  if (tagName === "user-query" || testId === "user-query" || node.classList.contains("user-query")) return "user";
  if (tagName === "message-content" || testId === "model-response" || node.classList.contains("model-response")) return "assistant";
  
  return null;
}

function annotateTurns() {
  const turns = document.querySelectorAll(SELECTORS.turns);
  turns.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const role = detectRole(node);
    if (!role) return;

    if (role === "user") {
      node.setAttribute("data-gpt-booster-hidden-prefix", "USER:");
      upsertVisibleTimestamp(node, "user");
      return;
    }
    if (role === "assistant") {
      node.setAttribute("data-gpt-booster-hidden-prefix", "AI:");
      upsertVisibleTimestamp(node, "assistant");
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
  ensureTimestampStyle();
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
