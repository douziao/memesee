async function copyWithTextarea(text, documentLike) {
  if (!documentLike?.createElement || !documentLike?.body || !documentLike?.execCommand) {
    throw new Error("Clipboard unavailable");
  }

  const textarea = documentLike.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  documentLike.body.appendChild(textarea);
  try {
    try {
      textarea.focus?.({ preventScroll: true });
    } catch {
      textarea.focus?.();
    }
    textarea.select?.();
    try {
      textarea.setSelectionRange?.(0, String(text).length);
    } catch {
      // Some legacy mobile browsers expose setSelectionRange but reject it here.
    }
    const copied = documentLike.execCommand("copy");

    if (!copied) {
      throw new Error("Clipboard copy failed");
    }
  } finally {
    documentLike.body.removeChild(textarea);
  }
}

export async function copyTextToClipboard(text, {
  navigatorLike = globalThis.navigator,
  documentLike = globalThis.document,
} = {}) {
  if (navigatorLike?.clipboard?.writeText) {
    try {
      await navigatorLike.clipboard.writeText(text);
      return;
    } catch {
      // Browser permission policy may reject async clipboard even when the API exists.
      // Keep the older textarea copy path as a last-mile sharing fallback.
    }
  }

  await copyWithTextarea(text, documentLike);
}
