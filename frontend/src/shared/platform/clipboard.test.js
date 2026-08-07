import { describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

function createClipboardDocumentMock({ execCommand }) {
  const appended = [];
  const documentLike = {
    body: {
      appendChild: vi.fn((element) => {
        appended.push(element);
      }),
      removeChild: vi.fn((element) => {
        const index = appended.indexOf(element);
        if (index >= 0) {
          appended.splice(index, 1);
        }
      }),
    },
    createElement: vi.fn(() => ({
      value: "",
      style: {},
      focus: vi.fn(),
      setAttribute: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
    })),
    execCommand,
  };
  return {
    appended,
    documentLike,
  };
}

describe("copyTextToClipboard", () => {
  it("uses async clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {
        clipboard: { writeText },
      },
      documentLike: null,
    });

    expect(writeText).toHaveBeenCalledWith("https://memesee.world/posts/42");
  });

  it("falls back to legacy textarea copy when async clipboard is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("permission denied"));
    const execCommand = vi.fn(() => true);
    const { appended, documentLike } = createClipboardDocumentMock({ execCommand });

    await copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {
        clipboard: { writeText },
      },
      documentLike,
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(appended).toHaveLength(0);
  });

  it("prepares the fallback textarea for mobile and legacy browser selection", async () => {
    const execCommand = vi.fn(() => true);
    const { documentLike } = createClipboardDocumentMock({ execCommand });

    await copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {},
      documentLike,
    });

    const textarea = documentLike.createElement.mock.results[0].value;
    expect(textarea.value).toBe("https://memesee.world/posts/42");
    expect(textarea.setAttribute).toHaveBeenCalledWith("readonly", "");
    expect(textarea.setAttribute).toHaveBeenCalledWith("aria-hidden", "true");
    expect(textarea.style).toEqual({
      position: "fixed",
      top: "0",
      left: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });
    expect(textarea.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(textarea.select).toHaveBeenCalled();
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, 30);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("still selects fallback text when focus options are unsupported", async () => {
    const execCommand = vi.fn(() => true);
    const { documentLike } = createClipboardDocumentMock({ execCommand });
    const textarea = documentLike.createElement();
    textarea.focus = vi.fn((options) => {
      if (options) {
        throw new Error("unsupported focus options");
      }
    });
    documentLike.createElement = vi.fn(() => textarea);

    await copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {},
      documentLike,
    });

    expect(textarea.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(textarea.focus).toHaveBeenCalledWith();
    expect(textarea.select).toHaveBeenCalled();
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, 30);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("continues legacy copy when setSelectionRange is unsupported", async () => {
    const execCommand = vi.fn(() => true);
    const { documentLike } = createClipboardDocumentMock({ execCommand });
    const textarea = documentLike.createElement();
    textarea.setSelectionRange = vi.fn(() => {
      throw new Error("unsupported selection range");
    });
    documentLike.createElement = vi.fn(() => textarea);

    await copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {},
      documentLike,
    });

    expect(textarea.select).toHaveBeenCalled();
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, 30);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("removes the fallback textarea when legacy copy fails", async () => {
    const { appended, documentLike } = createClipboardDocumentMock({
      execCommand: vi.fn(() => false),
    });

    await expect(copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {},
      documentLike,
    })).rejects.toThrow("Clipboard copy failed");

    expect(documentLike.body.removeChild).toHaveBeenCalledTimes(1);
    expect(appended).toHaveLength(0);
  });
});
