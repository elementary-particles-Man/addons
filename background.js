import { openDB, putChunk } from './idb.js';
const WS_URL = '';
let ws, wsReady = false, backoff = 500;
const connectWS = () => {
  if (!WS_URL) return;
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { wsReady = true; backoff = 500; };
    ws.onclose = () => { wsReady = false; setTimeout(connectWS, backoff); backoff = Math.min(backoff * 2, 10000); };
    ws.onerror = () => { try { ws.close(); } catch(e){} };
  } catch(e){ setTimeout(connectWS, backoff); backoff = Math.min(backoff * 2, 10000); }
};
connectWS();
const STORE='chunks';
let dbPromise = openDB('gpt-capture', STORE);
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === 'GPT_CHUNK') {
    const rec = { ...msg.payload };
    const db = await dbPromise;
    await putChunk(db, STORE, rec);
    if (ws && wsReady) {
      try { ws.send(JSON.stringify({ kind: 'chunk', ...rec })); } catch(e){}
    }
  }
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'PING') sendResponse({ pong: true, ws: !!WS_URL, wsReady });
});
