(function () {
  const DEFAULT_CONFIG = {
    aggressive: false,
    thinkingBoost: true
  };

  function loadConfig(cb) {
    if (!chrome.storage || !chrome.storage.local) {
      cb({ ...DEFAULT_CONFIG });
      return;
    }
    chrome.storage.local.get(["boosterConfig"], (data) => {
      const conf = (data && data.boosterConfig) || {};
      cb({ ...DEFAULT_CONFIG, ...conf });
    });
  }

  function saveConfig(conf) {
    if (!chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.set({ boosterConfig: conf });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const aggressiveEl = document.getElementById("aggressive");
    const thinkingEl = document.getElementById("thinkingBoost");

    loadConfig((conf) => {
      aggressiveEl.checked = !!conf.aggressive;
      thinkingEl.checked = !!conf.thinkingBoost;
    });

    aggressiveEl.addEventListener("change", () => {
      loadConfig((conf) => {
        conf.aggressive = aggressiveEl.checked;
        saveConfig(conf);
      });
    });

    thinkingEl.addEventListener("change", () => {
      loadConfig((conf) => {
        conf.thinkingBoost = thinkingEl.checked;
        saveConfig(conf);
      });
    });
  });
})();
