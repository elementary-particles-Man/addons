// Booster 3.1 background
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ boosterMode: 'B' });
  console.log('[Booster] Installed (default=B)');
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'mode-switch') {
    console.log(`[Booster] Mode changed to ${msg.mode}`);
  }
});
