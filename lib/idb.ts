"use client";

/** Key-value IndexedDB minimal, tanpa dependency. Dipakai untuk cache workspace
 *  lokal (spec v1.1 offline): IndexedDB, bukan localStorage, karena data URL
 *  gambar cepat menembus batas ~5MB localStorage — IndexedDB jauh lebih lega
 *  dan menyimpan objek apa adanya (tanpa JSON.stringify). */
const DB_NAME = "swanote";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Baca satu nilai dari database IndexedDB bernama lain — dipakai sekali untuk
 *  memigrasi data lokal saat nama db berganti (mis. "pinote" → "swanote"). Tak
 *  pernah membuat store; kalau db/store/key tak ada, kembalikan undefined. */
export async function idbGetFrom<T>(
  dbName: string,
  storeName: string,
  key: string
): Promise<T | undefined> {
  // Hindari membuat db kosong "hantu" bila db lamanya memang tak pernah ada.
  if (typeof indexedDB.databases === "function") {
    try {
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d.name === dbName)) return undefined;
    } catch {
      /* lanjut coba buka */
    }
  }
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(dbName);
    } catch {
      return resolve(undefined);
    }
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        return resolve(undefined);
      }
      try {
        const g = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
        g.onsuccess = () => {
          const v = g.result as T | undefined;
          db.close();
          resolve(v);
        };
        g.onerror = () => {
          db.close();
          resolve(undefined);
        };
      } catch {
        db.close();
        resolve(undefined);
      }
    };
    req.onerror = () => resolve(undefined);
  });
}
