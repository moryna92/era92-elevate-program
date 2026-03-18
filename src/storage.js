// Storage wrapper — uses localStorage for standalone Vercel deployment.
// All data is stored per-browser. For cross-device sync, swap this with
// a Supabase or Firebase implementation.

export async function storageGet(key) {
  try {
    // Try window.storage first (Claude artifact environment)
    if (window.storage) {
      const r = await window.storage.get(key, true);
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) {}
  // Fallback to localStorage
  try {
    const r = localStorage.getItem(key);
    if (r) return JSON.parse(r);
  } catch (e) {}
  return null;
}

export async function storageSet(key, value) {
  const str = JSON.stringify(value);
  try {
    if (window.storage) {
      await window.storage.set(key, str, true);
    }
  } catch (e) {}
  try {
    localStorage.setItem(key, str);
  } catch (e) {}
}

export async function storageDel(key) {
  try { if (window.storage) await window.storage.delete(key, true); } catch (e) {}
  try { localStorage.removeItem(key); } catch (e) {}
}
