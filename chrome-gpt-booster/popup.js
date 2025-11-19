document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['boosterMode'], ({ boosterMode }) => {
    const mode = boosterMode || 'B';
    const radio = document.querySelector(`input[value="${mode}"]`);
    if (radio) radio.checked = true;
  });

  for (const el of document.querySelectorAll('input[name="mode"]')) {
    el.addEventListener('change', () => {
      const val = el.value;
      chrome.storage.sync.set({ boosterMode: val });
      document.getElementById('status').textContent = `Mode switched to ${val}`;
      chrome.runtime.sendMessage({ type: 'mode-switch', mode: val });
    });
  }
});
