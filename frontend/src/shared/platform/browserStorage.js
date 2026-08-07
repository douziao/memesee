function getWindowObject() {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}

export function getLocalStorage() {
  const windowObject = getWindowObject();
  if (!windowObject) {
    return null;
  }
  try {
    return windowObject.localStorage || null;
  } catch {
    return null;
  }
}

export function readLocalStorageItem(key) {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorageItem(key, value) {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, String(value));
  } catch {
    // Storage can be blocked or quota-limited; callers should keep working.
  }
}

export function removeLocalStorageItem(key) {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(key);
  } catch {
    // Storage can be blocked by browser policy; removal is best-effort.
  }
}
