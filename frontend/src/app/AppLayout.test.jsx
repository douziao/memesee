import { describe, expect, it } from "vitest";
import { shouldRenderAuthModal, shouldRenderFloatingActions } from "./AppLayout";

describe("shouldRenderAuthModal", () => {
  it("only renders the lazy auth modal while an anonymous auth prompt is open", () => {
    expect(shouldRenderAuthModal({ authModalOpen: false, isLoggedIn: false })).toBe(false);
    expect(shouldRenderAuthModal({ authModalOpen: true, isLoggedIn: true })).toBe(false);
    expect(shouldRenderAuthModal({ authModalOpen: true, isLoggedIn: false })).toBe(true);
    expect(shouldRenderAuthModal(null)).toBe(false);
  });
});

describe("shouldRenderFloatingActions", () => {
  it("only renders the lazy floating actions when the scroll affordance is visible", () => {
    expect(shouldRenderFloatingActions({ show: false })).toBe(false);
    expect(shouldRenderFloatingActions({ show: true })).toBe(true);
    expect(shouldRenderFloatingActions(null)).toBe(false);
  });
});
