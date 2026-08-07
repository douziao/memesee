import { describe, expect, it } from "vitest";
import { responsiveImageLoadStateKey } from "./ResponsiveImage";

import { readFileSync } from "node:fs";
const responsiveImageSource = readFileSync(new URL("./ResponsiveImage.jsx", import.meta.url), "utf8");

describe("ResponsiveImage load-state notification contract", () => {
  it("dedupes parent notifications by failed/loaded state instead of retaining event objects", () => {
    expect(responsiveImageSource).toContain("const loadStateKeyRef = useRef(-1);");
    expect(responsiveImageSource).toContain("loadStateKeyRef.current = -1;");
    expect(responsiveImageSource).toContain(
      "const nextLoadStateKey = responsiveImageLoadStateKey(nextState);",
    );
    expect(responsiveImageSource).toContain(
      "const shouldNotify = loadStateKeyRef.current !== nextLoadStateKey;",
    );
    expect(responsiveImageSource).toContain("if (shouldNotify && typeof onLoadStateChangeRef.current === \"function\")");
  });

  it("tracks unavailable images as a distinct load state", () => {
    expect(responsiveImageLoadStateKey({ failed: true, loaded: false })).toBe(1);
    expect(responsiveImageLoadStateKey({ failed: false, loaded: true })).toBe(2);
    expect(responsiveImageLoadStateKey({ unavailable: true })).toBe(4);
  });

  it("does not render an img element for an empty image url", () => {
    expect(responsiveImageSource).toContain("const unavailable = !imageUrl;");
    expect(responsiveImageSource).toContain("{imageUrl && (");
    expect(responsiveImageSource).toContain("unavailable ? \"unavailable\"");
    expect(responsiveImageSource).toContain("notifyLoadState({ failed: false, loaded: false, unavailable: true }, null);");
    expect(responsiveImageSource).toContain("notifyLoadState({ failed: false, loaded: false, unavailable: false }, null);");
  });
});
