import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLocalStorage,
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from "./browserStorage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browserStorage", () => {
  it("returns null when localStorage is unavailable or blocked", () => {
    vi.stubGlobal("window", {});
    expect(getLocalStorage()).toBeNull();

    vi.stubGlobal("window", Object.defineProperty({}, "localStorage", {
      get() {
        throw new Error("storage blocked");
      },
    }));
    expect(getLocalStorage()).toBeNull();
  });

  it("reads, writes, and removes storage items when available", () => {
    const storage = {
      getItem: vi.fn(() => "stored-value"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("window", { localStorage: storage });

    expect(readLocalStorageItem("memesee_token")).toBe("stored-value");
    writeLocalStorageItem("memesee_token", 42);
    removeLocalStorageItem("memesee_token");

    expect(storage.getItem).toHaveBeenCalledWith("memesee_token");
    expect(storage.setItem).toHaveBeenCalledWith("memesee_token", "42");
    expect(storage.removeItem).toHaveBeenCalledWith("memesee_token");
  });

  it("fails closed when storage operations throw", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("read denied");
      }),
      setItem: vi.fn(() => {
        throw new Error("write denied");
      }),
      removeItem: vi.fn(() => {
        throw new Error("remove denied");
      }),
    };
    vi.stubGlobal("window", { localStorage: storage });

    expect(readLocalStorageItem("memesee_token")).toBeNull();
    expect(() => writeLocalStorageItem("memesee_token", "token")).not.toThrow();
    expect(() => removeLocalStorageItem("memesee_token")).not.toThrow();
  });
});
