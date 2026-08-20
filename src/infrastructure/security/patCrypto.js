// PAT encryption at rest - AES-GCM with non-extractable key in IndexedDB
// Mitigates plaintext exfiltration via XSS reading chrome.storage.local.
// Key is generated per-install, stored as CryptoKey (extractable:false) in IndexedDB.
// XSS still needs to compromise IndexedDB + storage, raising barrier vs plain text.

const DB_NAME = "syncly-pat-keys";
const STORE = "keys";
const KEY_ID = "pat-aes-key";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateKey() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(KEY_ID);
    getReq.onsuccess = async () => {
      if (getReq.result) {
        resolve(getReq.result);
      } else {
        try {
          const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
          );
          const putReq = store.put(key, KEY_ID);
          putReq.onsuccess = () => resolve(key);
          putReq.onerror = () => reject(putReq.error);
        } catch (e) {
          reject(e);
        }
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export async function encryptPat(plain) {
  if (typeof plain !== "string" || plain.length === 0) return null;
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain)
  );
  return { iv: bufToB64(iv.buffer), data: bufToB64(enc) };
}

export async function decryptPat(payload) {
  if (!payload || typeof payload !== "object" || !payload.iv || !payload.data) return null;
  try {
    const key = await getOrCreateKey();
    const iv = b64ToBuf(payload.iv);
    const data = b64ToBuf(payload.data);
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      data
    );
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

// Migration helper: decrypt or fallback to plaintext for old installs
export async function getDecryptedPat(storedValue) {
  if (!storedValue) return null;
  // New format: object with iv+data
  if (typeof storedValue === "object" && storedValue.iv && storedValue.data) {
    return await decryptPat(storedValue);
  }
  // Old plaintext format: string
  if (typeof storedValue === "string") return storedValue;
  return null;
}
