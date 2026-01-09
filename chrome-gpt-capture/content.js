(() => {
  const VERSION = "v4.2-thinking";
  const TAG = "[GPT-Capture]";
  console.log(`${TAG} content.js active (${VERSION})`);

  // どの環境か判定（chatgpt / gemini / unknown）
  function detectEnv() {
    const h = location.hostname || "";
    if (h.includes("chatgpt.com") || h.includes("chat.openai.com")) return "chatgpt";
    if (h.includes("gemini.google.com")) return "gemini";
    return "unknown";
  }

  let currentEnv = detectEnv();
  console.log(`${TAG} env detected: ${currentEnv}`);

  // すでに処理したノードを保持（重複キャプチャ防止）
  const processed = new WeakSet();

  // ChatGPT: アシスタントメッセージ（Thinking含む）候補ノードを取得
  function getChatGPTMessageNodes() {
    // 基本：アシスタント側 article
    const articles = document.querySelectorAll(
      'article[data-message-author-role="assistant"], article[aria-label^="Assistant response"]'
    );

    const nodes = [];
    articles.forEach((article) => {
      // 本文部位：markdown / main-panel を優先
      const md =
        article.querySelector(
          ".markdown.prose, .markdown.markdown-main-panel, .markdown.markdown-main-panel.stronger"
        ) || article.querySelector(".markdown");
      nodes.push(md || article);
    });

    return nodes;
  }

  // Gemini: Thinkingビューを含む main コンテンツ
  function getGeminiMessageNodes() {
    // あなたが提示してくれた id プレフィックスベース
    const mainBlocks = document.querySelectorAll(
      'div[id^="model-response-message-content"]'
    );

    const nodes = [];
    mainBlocks.forEach((block) => {
      // gemini 側は aria-busy=false で「確定」扱いにする
      const busy = block.getAttribute("aria-busy");
      if (busy === "true") return;
      nodes.push(block);
    });

    return nodes;
  }

  function getMessageNodes() {
    currentEnv = detectEnv();
    if (currentEnv === "chatgpt") return getChatGPTMessageNodes();
    if (currentEnv === "gemini") return getGeminiMessageNodes();
    return [];
  }

  function extractText(node) {
    if (!node) return "";
    // スクリーンリーダー用 hidden テキストなども含め、Thinkingも全部取る
    const text = node.innerText || node.textContent || "";
    return text.trim();
  }

  function buildPayload(node) {
    const text = extractText(node);
    if (!text) return null;

    // 短すぎるノイズを排除（ボタンだけ等）
    if (text.length < 20) return null;

    const now = new Date().toISOString();
    return {
      env: currentEnv,
      url: location.href,
      title: document.title,
      ts: now,
      text
    };
  }

  function sendPayload(payload) {
    try {
      chrome.runtime.sendMessage(
        {
          type: "capture",
          payload
        },
        (resp) => {
          // 応答は特に使わないが、エラー時はログに残す
          if (chrome.runtime.lastError) {
            console.warn(
              `${TAG} sendMessage error:`,
              chrome.runtime.lastError.message
            );
          } else if (resp && resp.ok) {
            // noop
          }
        }
      );
    } catch (e) {
      console.error(`${TAG} sendPayload failure`, e);
    }
  }

  function handleNode(node) {
    if (!node) return;
    if (processed.has(node)) return;

    const payload = buildPayload(node);
    if (!payload) return;

    processed.add(node);
    console.log(
      `${TAG} captured (${payload.env})`,
      payload.text.slice(0, 80).replace(/\s+/g, " ") + "..."
    );
    sendPayload(payload);
  }

  function scanAll() {
    const nodes = getMessageNodes();
    nodes.forEach(handleNode);
  }

  // 初回スキャン（DOM構築完了を軽く待つ）
  setTimeout(scanAll, 2000);

  // MutationObserver をスロットル付きで運用
  let pending = false;
  const observer = new MutationObserver((mutations) => {
    let hasAdd = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        hasAdd = true;
        break;
      }
    }
    if (!hasAdd) return;

    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      scanAll();
    }, 500);
  });

  try {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log(`${TAG} observer attached (${VERSION})`);
  } catch (e) {
    console.error(`${TAG} observer attach failed`, e);
  }
})();
