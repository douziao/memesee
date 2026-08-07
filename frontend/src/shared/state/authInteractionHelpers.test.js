import { describe, expect, it, vi } from "vitest";
import { notifyAuthRequired } from "./authInteractionHelpers";
import { UI_MESSAGES } from "./uiMessages";

describe("notifyAuthRequired", () => {
  it("keeps the auth-required toast and opens the login modal", () => {
    const setMessage = vi.fn();
    const onAuthRequired = vi.fn();

    notifyAuthRequired({ setMessage, onAuthRequired });

    expect(setMessage).toHaveBeenCalledWith(UI_MESSAGES.authRequired);
    expect(onAuthRequired).toHaveBeenCalledWith("login");
  });

  it("does not fail when either UI callback is unavailable", () => {
    expect(() => notifyAuthRequired({})).not.toThrow();
  });
});
