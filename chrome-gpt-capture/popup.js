const logEl = document.getElementById("log");

function setStatus(text) {
  if (logEl) logEl.textContent = text;
}

document.getElementById("flush").onclick = () => {
  chrome.runtime.sendMessage({ type: "REQUEST_FULL_DUMP" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Error: " + chrome.runtime.lastError.message);
      return;
    }

    if (resp?.ok) {
      const text = resp.text || "";
      navigator.clipboard.writeText(text).then(
        () => setStatus(`Copied ${resp.count ?? 0} items.`),
        () => setStatus("Clipboard error.")
      );
    } else {
      setStatus("No data");
    }
  });
};

document.getElementById("clear").onclick = () => {
  chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Error: " + chrome.runtime.lastError.message);
      return;
    }
    setStatus(resp?.ok ? "Cleared" : "Failed to clear.");
  });
};

document.getElementById("download").onclick = () => {
  chrome.runtime.sendMessage({ type: "SAVE_RECENT_FILE", limit: 200 }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Error: " + chrome.runtime.lastError.message);
      return;
    }

    if (resp?.ok) {
      setStatus(`Saved ${resp.count ?? 0} items to ${resp.filename || "file"}.`);
    } else {
      setStatus("Save failed: " + (resp?.error || "unknown error"));
    }
  });
};
