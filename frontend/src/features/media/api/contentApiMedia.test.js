import { describe, expect, it } from "vitest";
import {
  getMediaAsset,
  uploadMediaAsset,
} from "./contentApiMedia";

describe("content media API", () => {
  it("normalizes uploaded media asset responses", async () => {
    const file = new Blob(["image"], { type: "image/png" });
    const client = {
      defaults: { baseURL: "https://api.example.com" },
      post: async (path, body) => {
        expect(path).toBe("/api/media-assets");
        expect(body).toBeInstanceOf(FormData);
        return {
          data: {
            id: 7,
            displayUrl: "/media/7/display.webp",
            processingStatus: "READY",
          },
        };
      },
    };

    await expect(uploadMediaAsset(client, { token: "token", file })).resolves.toMatchObject({
      id: 7,
      displayUrl: "https://api.example.com/media/7/display.webp",
      processingStatus: "READY",
    });
  });

  it("fetches and normalizes refreshed media asset metadata", async () => {
    const client = {
      defaults: { baseURL: "https://api.example.com" },
      get: async (path) => {
        expect(path).toBe("/api/media-assets/42");
        return {
          data: {
            id: 42,
            displayUrl: "/media/42/display.webp",
            processingStatus: "READY",
          },
        };
      },
    };

    await expect(getMediaAsset(client, { assetId: 42 })).resolves.toMatchObject({
      id: 42,
      displayUrl: "https://api.example.com/media/42/display.webp",
      processingStatus: "READY",
    });
  });
});
