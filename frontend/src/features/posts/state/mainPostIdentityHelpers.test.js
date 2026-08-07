import { describe, expect, it } from "vitest";
import {
  normalizeMainPostId,
  resolveMainPostId,
} from "./mainPostIdentityHelpers";

describe("main post identity helpers", () => {
  it("normalizes positive integer main-post ids", () => {
    expect(normalizeMainPostId(42)).toBe(42);
    expect(normalizeMainPostId("42")).toBe(42);
    expect(normalizeMainPostId("")).toBe(0);
    expect(normalizeMainPostId(0)).toBe(0);
    expect(normalizeMainPostId(-1)).toBe(0);
    expect(normalizeMainPostId(1.5)).toBe(0);
    expect(normalizeMainPostId("abc")).toBe(0);
  });

  it("resolves id aliases without letting malformed preferred fields block fallbacks", () => {
    expect(resolveMainPostId({ id: 42 })).toBe(42);
    expect(resolveMainPostId({ postId: "42" })).toBe(42);
    expect(resolveMainPostId({ mainPostId: "42" })).toBe(42);
    expect(resolveMainPostId({ id: "draft", postId: 42 })).toBe(42);
    expect(resolveMainPostId({ id: 0, postId: "bad", mainPostId: 7 })).toBe(7);
    expect(resolveMainPostId(null)).toBe(0);
  });
});
