// ChatGPT DOM監視 → 差分抽出
const SELECTORS = [
  '[data-message-author-role="assistant"]',
  'article div.markdown',
  'div[data-testid="conversation-turn"] [data-message-author-role="assistant"]'
];
let lastSnapshot = '';
const getText = () => {
  const nodes = [];
  for (const sel of SELECTORS) document.querySelectorAll(sel).forEach(n => nodes.push(n));
  return nodes.map(n => n.innerText || '').join('\n\n').trim();
};
const diff = (prev, next) => next.startsWith(prev) ? next.slice(prev.length) : next;
const sendChunk = chunk => {
  if (!chunk) return;
  chrome.runtime.sendMessage({ type: 'GPT_CHUNK', payload: { text: chunk, ts: Date.now(), url: location.href } });
};
const observer = new MutationObserver(() => {
  queueMicrotask(() => {
    const now = getText();
    const delta = diff(lastSnapshot, now);
    if (delta && delta.trim().length) { sendChunk(delta); lastSnapshot = now; }
  });
});
observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
setTimeout(() => { lastSnapshot = getText(); }, 1200);
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type === 'REQUEST_FULL_DUMP') {
    const now = getText();
    const delta = diff(lastSnapshot, now);
    if (delta) sendChunk(delta);
    lastSnapshot = now;
    sendResponse({ ok: true });
  }
});
