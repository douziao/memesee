import { buildAuthHeaders } from "../../content/api/contentApiShared";
import { normalizeMediaAsset } from "../../content/api/contentApiMappers";

/**
 * @param {{ post: Function, defaults?: { baseURL?: string } }} client
 * @param {{ token?: string, file: File | Blob }} options
 */
export async function uploadMediaAsset(client, { token, file }) {
  const apiBase = client?.defaults?.baseURL || "";
  const formData = new FormData();
  formData.append("file", file);
  const response = await client.post("/api/media-assets", formData, {
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return normalizeMediaAsset(apiBase, payload);
}

export async function getMediaAsset(client, { assetId }) {
  const apiBase = client?.defaults?.baseURL || "";
  const response = await client.get(`/api/media-assets/${encodeURIComponent(String(assetId || ""))}`);
  return normalizeMediaAsset(apiBase, response?.data || {});
}
