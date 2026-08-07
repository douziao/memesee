import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLightboxOriginalState,
  buildLightboxImageFailureState,
  callLightboxClose,
  clampLightboxIndex,
  resolveLightboxKeyAction,
  resolveLightboxNavigation,
} from "./ImageLightbox";

const imageLightboxSource = readFileSync(new URL("./ImageLightbox.jsx", import.meta.url), "utf8");
const imageLightboxCss = readFileSync(new URL("./ImageLightbox.css", import.meta.url), "utf8");

describe("clampLightboxIndex", () => {
  it("keeps lightbox indexes valid for bad input and changing image counts", () => {
    expect(clampLightboxIndex(0, 3)).toBe(0);
    expect(clampLightboxIndex(2, 3)).toBe(2);
    expect(clampLightboxIndex(9, 3)).toBe(2);
    expect(clampLightboxIndex(-3, 3)).toBe(0);
    expect(clampLightboxIndex(1.9, 3)).toBe(1);
    expect(clampLightboxIndex("bad", 3)).toBe(0);
    expect(clampLightboxIndex(Number.NaN, 3)).toBe(0);
    expect(clampLightboxIndex(2, 0)).toBe(0);
  });
});

describe("resolveLightboxNavigation", () => {
  it("reports whether lightbox navigation actually changes the image", () => {
    expect(resolveLightboxNavigation(1, 3, -1)).toEqual({
      index: 0,
      changed: true,
    });
    expect(resolveLightboxNavigation(1, 3, 1)).toEqual({
      index: 2,
      changed: true,
    });
    expect(resolveLightboxNavigation(0, 3, -1)).toEqual({
      index: 0,
      changed: false,
    });
    expect(resolveLightboxNavigation(2, 3, 1)).toEqual({
      index: 2,
      changed: false,
    });
    expect(resolveLightboxNavigation("bad", 3, 1)).toEqual({
      index: 1,
      changed: true,
    });
  });
});

describe("callLightboxClose", () => {
  it("invokes valid close handlers and ignores missing handlers", () => {
    let closeCount = 0;

    expect(callLightboxClose(() => {
      closeCount += 1;
    })).toBe(true);
    expect(closeCount).toBe(1);

    expect(callLightboxClose(undefined)).toBe(false);
    expect(callLightboxClose("not-a-function")).toBe(false);
    expect(closeCount).toBe(1);
  });
});

describe("resolveLightboxKeyAction", () => {
  it("maps supported keyboard shortcuts to viewer actions", () => {
    expect(resolveLightboxKeyAction("Escape")).toBe("close");
    expect(resolveLightboxKeyAction("ArrowLeft")).toBe("previous");
    expect(resolveLightboxKeyAction("ArrowRight")).toBe("next");
    expect(resolveLightboxKeyAction("+")).toBe("zoom-in");
    expect(resolveLightboxKeyAction("=")).toBe("zoom-in");
    expect(resolveLightboxKeyAction("-")).toBe("zoom-out");
    expect(resolveLightboxKeyAction("_")).toBe("zoom-out");
    expect(resolveLightboxKeyAction("0")).toBe("reset");
    expect(resolveLightboxKeyAction("Tab")).toBe("");
  });
});

describe("buildLightboxImageFailureState", () => {
  it("keeps the image failure notice hidden while the current image is usable", () => {
    expect(buildLightboxImageFailureState({
      currentUrl: "/media/display.webp",
      imageFailed: false,
      canPrev: false,
      canNext: false,
    })).toEqual({
      show: false,
      message: "",
      hint: "",
    });
    expect(buildLightboxImageFailureState({
      currentUrl: "",
      imageFailed: true,
    }).show).toBe(false);
  });

  it("explains single-image failures without implying navigation is available", () => {
    expect(buildLightboxImageFailureState({
      currentUrl: "/media/display.webp",
      imageFailed: true,
      canPrev: false,
      canNext: false,
    })).toEqual({
      show: true,
      message: "图片加载失败",
      hint: "可以重新加载当前图片。",
      retryLabel: "重新加载",
    });
  });

  it("keeps navigation recovery visible when adjacent images exist", () => {
    expect(buildLightboxImageFailureState({
      currentUrl: "/media/display.webp",
      imageFailed: true,
      canPrev: false,
      canNext: true,
    })).toEqual({
      show: true,
      message: "图片加载失败",
      hint: "可以重新加载当前图片，或切换其它图片。",
      retryLabel: "重新加载",
    });
  });
});

describe("buildLightboxOriginalState", () => {
  it("marks the original image as unavailable when no original candidate exists", () => {
    expect(buildLightboxOriginalState({
      displayUrl: "/media/display.webp",
      originalCandidateUrl: "",
    })).toMatchObject({
      currentUrl: "/media/display.webp",
      originalUrl: "/media/display.webp",
      hasOriginalCandidate: false,
      hasDistinctOriginalUrl: false,
      isUsingOriginal: false,
      canUseOriginal: false,
      toggleLabel: "原图不可用",
      buttonText: "原图",
    });
  });

  it("explains when the display image is already the original image", () => {
    expect(buildLightboxOriginalState({
      displayUrl: "/media/original.webp",
      originalCandidateUrl: "/media/original.webp",
    })).toMatchObject({
      hasOriginalCandidate: true,
      hasDistinctOriginalUrl: false,
      isUsingOriginal: false,
      canUseOriginal: false,
      toggleLabel: "当前已是原图",
      buttonText: "原图",
    });
  });

  it("switches between display and original URLs only when they are distinct", () => {
    expect(buildLightboxOriginalState({
      displayUrl: "/media/display.webp",
      originalCandidateUrl: "/media/original.webp",
      useOriginal: false,
    })).toMatchObject({
      currentUrl: "/media/display.webp",
      originalUrl: "/media/original.webp",
      hasOriginalCandidate: true,
      hasDistinctOriginalUrl: true,
      isUsingOriginal: false,
      canUseOriginal: true,
      toggleLabel: "查看原图",
      buttonText: "原图",
    });

    expect(buildLightboxOriginalState({
      displayUrl: "/media/display.webp",
      originalCandidateUrl: "/media/original.webp",
      useOriginal: true,
    })).toMatchObject({
      currentUrl: "/media/original.webp",
      isUsingOriginal: true,
      canUseOriginal: true,
      toggleLabel: "使用展示图",
      buttonText: "展示图",
    });
  });
});

describe("ImageLightbox recovery accessibility contract", () => {
  it("presents the fullscreen viewer as a modal dialog and restores focus after closing", () => {
    expect(imageLightboxSource).toContain('role="dialog"');
    expect(imageLightboxSource).toContain('aria-modal="true"');
    expect(imageLightboxSource).toContain('aria-label="图片预览"');
    expect(imageLightboxSource).toContain("const previouslyFocusedElement = document.activeElement;");
    expect(imageLightboxSource).toContain("closeButtonRef.current || overlayRef.current");
    expect(imageLightboxSource).toContain("previouslyFocusedElement.focus({ preventScroll: true });");
  });

  it("prevents handled lightbox shortcuts from leaking to the page", () => {
    expect(imageLightboxSource).toContain("const keyAction = resolveLightboxKeyAction(event.key);");
    expect(imageLightboxSource).toContain("event.preventDefault();");
    expect(imageLightboxSource).toContain('keyAction === "reset"');
  });

  it("announces image failures and links retry controls to recovery copy", () => {
    expect(imageLightboxSource).toContain("const recoveryDescriptionBaseId = useId();");
    expect(imageLightboxSource).toContain("const recoveryDescriptionIds = `${recoveryLabelId} ${recoveryHintId}`;");
    expect(imageLightboxSource).toMatch(
      /className="image-lightbox-failure"[\s\S]*role="alert"[\s\S]*aria-live="assertive"/,
    );
    expect(imageLightboxSource).toMatch(/<strong id=\{recoveryLabelId\}>/);
    expect(imageLightboxSource).toMatch(/<em id=\{recoveryHintId\}>/);
    expect(imageLightboxSource).toMatch(/aria-describedby=\{recoveryDescriptionIds\}/);
  });

  it("keeps the retry control large enough for touch recovery", () => {
    expect(imageLightboxCss).toMatch(
      /\.image-lightbox-retry\s*{[^}]*min-height:\s*40px;/,
    );
  });

  it("keeps mobile lightbox controls in stable touch targets", () => {
    expect(imageLightboxCss).toMatch(
      /\.image-lightbox-tool\s*{[^}]*min-width:\s*40px;[^}]*height:\s*40px;/,
    );
    expect(imageLightboxCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.image-lightbox-close\s*{[^}]*width:\s*40px;[^}]*height:\s*40px;/,
    );
    expect(imageLightboxCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.image-lightbox-tool\s*{[^}]*min-width:\s*40px;[^}]*height:\s*40px;/,
    );
  });

  it("keeps fullscreen mobile controls clear of dynamic viewport and safe-area edges", () => {
    expect(imageLightboxCss).toMatch(
      /\.image-lightbox-overlay\s*{[^}]*height:\s*100dvh;[^}]*--image-lightbox-safe-top:\s*max\(var\(--image-lightbox-control-margin\),\s*env\(safe-area-inset-top\)\);/,
    );
    expect(imageLightboxCss).toMatch(
      /\.image-lightbox-stage\s*{[^}]*top:\s*env\(safe-area-inset-top\);[^}]*bottom:\s*env\(safe-area-inset-bottom\);/,
    );
    expect(imageLightboxCss).toMatch(
      /\.image-lightbox-close\s*{[^}]*top:\s*var\(--image-lightbox-safe-top\);[^}]*right:\s*var\(--image-lightbox-safe-right\);/,
    );
    expect(imageLightboxCss).toMatch(
      /\.image-lightbox-counter\s*{[^}]*top:\s*var\(--image-lightbox-safe-top\);[^}]*left:\s*var\(--image-lightbox-safe-left\);/,
    );
    expect(imageLightboxCss).toMatch(
      /\.image-lightbox-toolbar\s*{[^}]*bottom:\s*var\(--image-lightbox-safe-bottom\);/,
    );
    expect(imageLightboxCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.image-lightbox-toolbar\s*{[^}]*max-width:\s*calc\(100vw - var\(--image-lightbox-safe-left\) - var\(--image-lightbox-safe-right\)\);[^}]*overflow-x:\s*auto;/,
    );
  });
});
