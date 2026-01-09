(() => {
    const BOOSTER_FLAG = true;
    if (!BOOSTER_FLAG) return;

    // ---- 設定（デフォルト） ----
    let config = {
        aggressive: false,     // 高速化レベル（true = かなり攻める）
        thinkingBoost: true    // Thinking モード向け最適化を有効化
    };

    // chrome.storage から設定を読み込む
    try {
        if (typeof chrome !== "undefined" &&
            chrome.storage && chrome.storage.local) {

            chrome.storage.local.get(["boosterConfig"], (data) => {
                if (data && data.boosterConfig && typeof data.boosterConfig === "object") {
                    config = { ...config, ...data.boosterConfig };
                }
            });

            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === "local" && changes.boosterConfig) {
                    const v = changes.boosterConfig.newValue;
                    if (v && typeof v === "object") {
                        config = { ...config, ...v };
                    }
                }
            });
        }
    } catch (_) {
        // storage が使えない環境ではデフォルトのまま
    }

    // ---- 監視セレクタ ----
    const SELECTORS = [
        'article[data-turn="assistant"]',
        '.markdown',
        '.markdown-main-panel'
    ];

    // 一度だけ body / html 全体に軽量最適化を入れておく
    let globalTuned = false;
    function tuneGlobal() {
        if (globalTuned) return;
        globalTuned = true;
        try {
            const html = document.documentElement;
            const body = document.body;
            if (html) {
                html.style.scrollBehavior = "auto";
            }
            if (body) {
                body.style.transition = "none";
                body.style.animation = "none";
            }
        } catch (_) {}
    }

    tuneGlobal();

    // ---- MutationObserver ----
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (!m.addedNodes) continue;
            for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                let target = null;

                if (SELECTORS.some(sel => node.matches(sel))) {
                    target = node;
                } else {
                    for (const sel of SELECTORS) {
                        const found = node.querySelector(sel);
                        if (found) {
                            target = found;
                            break;
                        }
                    }
                }

                if (target) {
                    boost(target);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // ---- ブースト処理 ----
    function boost(el) {
        try {
            // --- 共通（通常モード / Thinking モード双方） ---
            el.style.transition = "none";
            el.style.animation = "none";
            el.style.willChange = "auto";

            // --- Thinking モード安全ブースト ---
            if (config.thinkingBoost) {
                // GPU レイヤー分離（描画安定化 / reflow 衝突防止）
                el.style.backfaceVisibility = "hidden";
                el.style.transform = "translateZ(0)";
            }

            // --- Aggressive 最適化は Thinking では絶対適用しない ---
            if (config.aggressive && !config.thinkingBoost) {
                const parent = el.closest("main, div");
                if (parent && parent !== el) {
                    parent.style.transition = "none";
                    parent.style.animation = "none";
                }
            }

            // Reflow commit（Chrome 最適化のための flush）
            void el.offsetHeight;

        } catch (e) {
            // UI を壊さないために無視（サイレントフェイル）
        }
    }
})();
