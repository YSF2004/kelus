/**
 * A file shared to Kelus from another app (Android's share sheet: a PDF from WhatsApp, Drive or Files). The service
 * worker (public/sw.js) receives it and keeps it here, in IndexedDB on this device, until Today takes it. Nothing is
 * uploaded; the file goes through the same import as one dropped on the start screen.
 */
const DB = "kelus-share";
const STORE = "files";
const KEY = "shared";

type Stored = { name: string; type: string; blob: Blob };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The shared file, once: it is removed as it is read, so a reload never imports it twice. */
export async function takeSharedFile(): Promise<File | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const request = store.get(KEY);
      request.onsuccess = () => {
        const stored = request.result as Stored | undefined;
        store.delete(KEY);
        resolve(stored ? new File([stored.blob], stored.name, { type: stored.type }) : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

let taken: Promise<File | null> | null = null;

/**
 * The shared file, read at most once per page load: every caller gets the same answer. Taking it deletes it from the
 * device, so a second read (React runs effects twice in development, and a remount runs them again) would find
 * nothing and lose the file. Reading once and sharing the result keeps it.
 */
export function takeSharedFileOnce(): Promise<File | null> {
  taken ??= takeSharedFile();
  return taken;
}
