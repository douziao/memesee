const FALLBACK_BROWSER_URL = "http://localhost/";

function getWindowObject() {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}

export function readBrowserUrl() {
  const windowObject = getWindowObject();
  const href = windowObject?.location?.href;
  if (typeof href === "string" && href.trim()) {
    return new URL(href);
  }
  return new URL(FALLBACK_BROWSER_URL);
}

export function readBrowserSearchParams() {
  const windowObject = getWindowObject();
  return new URLSearchParams(windowObject?.location?.search || "");
}

export function readBrowserCurrentPath() {
  const windowObject = getWindowObject();
  const pathname = windowObject?.location?.pathname || "/";
  const search = windowObject?.location?.search || "";
  return `${pathname}${search}`;
}

export function pushBrowserHistory(nextPath) {
  const windowObject = getWindowObject();
  if (!windowObject?.history?.pushState || !nextPath) {
    return false;
  }
  if (readBrowserCurrentPath() === nextPath) {
    return false;
  }
  windowObject.history.pushState({}, "", nextPath);
  return true;
}

export function scrollBrowserTo(options) {
  const windowObject = getWindowObject();
  if (typeof windowObject?.scrollTo !== "function") {
    return;
  }
  windowObject.scrollTo(options);
}
