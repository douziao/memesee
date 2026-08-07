import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEYS,
  getStoredAuthSession,
  LEGACY_AUTH_STORAGE_KEYS,
  writeStoredAuthSession,
} from "./authStorage";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(storage) {
  vi.stubGlobal("window", { localStorage: storage });
}

describe("authStorage", () => {
  it("returns an anonymous session when storage is unavailable", () => {
    vi.stubGlobal("window", {});

    expect(getStoredAuthSession()).toEqual({
      token: "",
      currentUser: "",
      currentUserLevel: 0,
    });
  });

  it("migrates legacy auth keys into MemeSee names", () => {
    const values = new Map([
      [LEGACY_AUTH_STORAGE_KEYS.token, "legacy-token"],
      [LEGACY_AUTH_STORAGE_KEYS.user, "nya"],
      [LEGACY_AUTH_STORAGE_KEYS.userLevel, "3"],
    ]);
    const storage = {
      getItem: vi.fn((key) => values.has(key) ? values.get(key) : null),
      setItem: vi.fn((key, value) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key) => {
        values.delete(key);
      }),
    };
    stubStorage(storage);

    expect(getStoredAuthSession()).toEqual({
      token: "legacy-token",
      currentUser: "nya",
      currentUserLevel: 3,
    });
    expect(values.get(AUTH_STORAGE_KEYS.token)).toBe("legacy-token");
    expect(values.has(LEGACY_AUTH_STORAGE_KEYS.token)).toBe(false);
  });

  it("does not crash when legacy migration writes are blocked", () => {
    const storage = {
      getItem: vi.fn((key) => {
        if (key === LEGACY_AUTH_STORAGE_KEYS.token) return "legacy-token";
        if (key === LEGACY_AUTH_STORAGE_KEYS.user) return "nya";
        if (key === LEGACY_AUTH_STORAGE_KEYS.userLevel) return "bad-level";
        return null;
      }),
      setItem: vi.fn(() => {
        throw new Error("write denied");
      }),
      removeItem: vi.fn(() => {
        throw new Error("remove denied");
      }),
    };
    stubStorage(storage);

    expect(getStoredAuthSession()).toEqual({
      token: "legacy-token",
      currentUser: "nya",
      currentUserLevel: 0,
    });
  });

  it("keeps auth writes best-effort when storage throws", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error("write denied");
      }),
      removeItem: vi.fn(() => {
        throw new Error("remove denied");
      }),
    };
    stubStorage(storage);

    expect(() => writeStoredAuthSession({
      token: "token",
      currentUser: "nya",
      currentUserLevel: 2,
    })).not.toThrow();
  });
});
