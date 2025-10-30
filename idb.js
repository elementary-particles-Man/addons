// IndexedDB helper
export const openDB = (name = 'gpt-capture', store = 'chunks') => new Promise((resolve, reject) => {
  const req = indexedDB.open(name, 1);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(store)) {
      const os = db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
      os.createIndex('ts', 'ts', { unique: false });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const putChunk = async (db, store, data) => new Promise((resolve, reject) => {
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).add(data);
  tx.oncomplete = resolve;
  tx.onerror = () => reject(tx.error);
});

export const getAll = async (db, store, limit = 2000) => new Promise((resolve, reject) => {
  const out = [];
  const tx = db.transaction(store, 'readonly');
  const idx = tx.objectStore(store).index('ts');
  const req = idx.openCursor(null, 'prev');
  req.onsuccess = e => {
    const cur = e.target.result;
    if (!cur || out.length >= limit) return resolve(out);
    out.push(cur.value); cur.continue();
  };
  req.onerror = () => reject(req.error);
});

export const clearAll = async (db, store) => new Promise((resolve, reject) => {
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  tx.oncomplete = resolve;
  tx.onerror = () => reject(tx.error);
});
