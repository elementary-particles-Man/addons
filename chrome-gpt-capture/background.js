// background.js v4.2
// ChatGPT / Gemini のキャプチャを IndexedDB に蓄積し、
// ポップアップからのコピー／削除／ファイル保存要求に応答します。

import { openDB, putChunk, getAll, clearAll } from "./idb.js";

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB("gpt-capture", "chunks");
  }
  return dbPromise;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("chrome-gpt-capture v4.2 initialized");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "CAPTURE_LOG" && msg.data) {
        // content.js からのキャプチャイベント
        const db = await getDB();
        const originUrl = sender?.tab?.url || "";

        const record = {
          ...msg.data,
          origin: originUrl,
          ts: msg.data.ts || Date.now()
        };

        await putChunk(db, "chunks", record);

        // 併せて簡易テキストバッファも維持（ポップアップ即時表示用）
        const line = JSON.stringify(record);
        chrome.storage.local.get(["captureBuffer"], (res) => {
          const prev = res.captureBuffer || "";
          const next = prev ? prev + "\n" + line : line;
          // メモリ節約のため末尾 20KB 程度だけ残す
          const MAX_CHARS = 20000;
          const trimmed = next.length > MAX_CHARS
            ? next.slice(next.length - MAX_CHARS)
            : next;
          chrome.storage.local.set({ captureBuffer: trimmed });
        });

        // CAPTURE_LOG はレスポンス不要
        return;
      }

      if (msg.type === "REQUEST_FULL_DUMP") {
        const db = await getDB();
        const rows = await getAll(db, "chunks", 200);
        const text = rows
          .map(r => {
            const ts = new Date(r.ts || Date.now()).toISOString();
            const origin = r.origin || "";
            return `[${ts}] ${origin}\n${r.sample || ""} (len=${r.len})`;
          })
          .join("\n\n");

        sendResponse({ ok: true, text, count: rows.length });
        return;
      }

      if (msg.type === "CLEAR_ALL") {
        const db = await getDB();
        await clearAll(db, "chunks");
        chrome.storage.local.set({ captureBuffer: "" });
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === "SAVE_RECENT_FILE") {
        const limit = msg.limit || 200;
        const db = await getDB();
        const rows = await getAll(db, "chunks", limit);

        if (!rows.length) {
          sendResponse({ ok: false, error: "no data" });
          return;
        }

        const text = rows.map(r => JSON.stringify(r)).join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const stamp = now.toISOString().replace(/[:.]/g, "-");
        const filename = `gpt-capture/${stamp}.log`;

        await chrome.downloads.download({
          url,
          filename,
          saveAs: false
        });

        sendResponse({ ok: true, count: rows.length, filename });

        // 後始末
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
    } catch (e) {
      console.warn("[GPT-Capture] background error", e);
      try {
        sendResponse({ ok: false, error: String(e) });
      } catch {
        // ignore
      }
    }
  })();

  // 非同期 sendResponse を許可
  return true;
});
