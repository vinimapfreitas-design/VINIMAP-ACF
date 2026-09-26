// IndexedDB Local Storage Helper for Offline Data
const DB_NAME = 'ViniMapFleetDB';
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('couriers')) {
        db.createObjectStore('couriers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToLocalStore(storeName: string, items: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      if (item && item.id) {
        store.put(item);
      }
    }
  } catch (err) {
    console.warn(`[IndexedDB] Error saving to ${storeName}:`, err);
  }
}

export async function getFromLocalStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []) as T[]);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error reading from ${storeName}:`, err);
    return [];
  }
}

export async function clearLocalStore(storeName: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
  } catch (err) {
    console.warn(`[IndexedDB] Error clearing ${storeName}:`, err);
  }
}

export async function removeFromLocalStore(storeName: string, id: string): Promise<void> {
  try {
    if (!id) return;
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
  } catch (err) {
    console.warn(`[IndexedDB] Error deleting ${id} from ${storeName}:`, err);
  }
}

// Aliases and Key-Value Helpers
export const getAllFromStore = getFromLocalStore;
export const saveAllToStore = saveToLocalStore;
export const removeFromStore = removeFromLocalStore;

export async function clearAllStores(): Promise<void> {
  await clearLocalStore('orders');
  await clearLocalStore('couriers');
  await clearLocalStore('logs');
}

export async function getVal<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(`vm_kv_${key}`);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export async function setVal<T>(key: string, value: T): Promise<void> {
  try {
    localStorage.setItem(`vm_kv_${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn("setVal error", e);
  }
}

export async function removeVal(key: string): Promise<void> {
  try {
    localStorage.removeItem(`vm_kv_${key}`);
  } catch (e) {
    console.warn("removeVal error", e);
  }
}

