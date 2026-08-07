import { describe, expect, it } from "vitest";
import {
  extractMarkdownCodeText,
  keepMarkdownUrl,
  normalizeMarkdownLinkHref,
} from "./markdownRenderHelpers";

describe("markdown render helpers", () => {
  it("keeps internal media references for the markdown image resolver", () => {
    expect(keepMarkdownUrl("media:42")).toBe("media:42");
    expect(keepMarkdownUrl(" media:public-id ")).toBe(" media:public-id ");
  });

  it("sanitizes non-media markdown URLs through the local protocol allowlist", () => {
    expect(keepMarkdownUrl("https://memesee.world/posts/42"))
      .toBe("https://memesee.world/posts/42");
    expect(keepMarkdownUrl("javascript:alert(1)")).toBe("");
  });

  it("normalizes markdown links without treating them as API media paths", () => {
    expect(normalizeMarkdownLinkHref("https://memesee.world/posts/42", "/api"))
      .toBe("https://memesee.world/posts/42");
    expect(normalizeMarkdownLinkHref("http://localhost:8080/posts/42?subPost=7", "/api"))
      .toBe("/posts/42?subPost=7");
    expect(normalizeMarkdownLinkHref("posts/42", "/api")).toBe("/posts/42");
    expect(normalizeMarkdownLinkHref("/posts/42", "/api")).toBe("/posts/42");
    expect(normalizeMarkdownLinkHref("#comments", "/api")).toBe("#comments");
    expect(normalizeMarkdownLinkHref("mailto:hello@memesee.world", "/api"))
      .toBe("mailto:hello@memesee.world");
  });

  it("drops unsupported protocols from markdown links", () => {
    expect(normalizeMarkdownLinkHref("javascript:alert(1)", "/api")).toBe("");
    expect(normalizeMarkdownLinkHref("data:text/html,hello", "/api")).toBe("");
  });

  it("extracts copyable text from markdown code nodes", () => {
    expect(extractMarkdownCodeText({
      props: {
        children: ["const a = 1;", "\n"],
      },
    })).toBe("const a = 1;\n");
  });

  it("handles nested and fragmented code children", () => {
    expect(extractMarkdownCodeText([
      "one",
      {
        props: {
          children: ["\n", { props: { children: "two" } }],
        },
      },
      false,
      null,
    ])).toBe("one\ntwo");
  });
});
