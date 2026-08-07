let confirmDialogHandler = null;

export function registerConfirmDialogHandler(handler) {
  confirmDialogHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (confirmDialogHandler === handler) {
      confirmDialogHandler = null;
    }
  };
}

export function confirmInBrowser(message, options = {}) {
  if (typeof confirmDialogHandler === "function") {
    return confirmDialogHandler({
      message,
      ...options,
    });
  }
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return Promise.resolve(false);
  }
  return Promise.resolve(window.confirm(message));
}
