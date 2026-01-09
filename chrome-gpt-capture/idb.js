export const openDB = (name = 'gpt-capture', store = 'chunks') =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(store)) {
        const os = db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        os.createIndex('ts', 'ts', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const putChunk = (db, store, data) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).add(data);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

export const getAll = (db, store, limit = 200) =>
  new Promise((resolve, reject) => {
    const out = [];
    const tx = db.transaction(store, 'readonly');
    const idx = tx.objectStore(store).index('ts');
    const req = idx.openCursor(null, 'prev');
    req.onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor || out.length >= limit) {
        resolve(out);
        return;
      }
      out.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });

export const clearAll = (db, store) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
