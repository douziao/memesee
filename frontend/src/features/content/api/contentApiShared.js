export function buildAuthHeaders(token) {
  return token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
}

export function normalizePositiveId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export function normalizeAssetUrl(apiBase, pathOrUrl) {
  const rawValue = String(pathOrUrl || "").trim();
  if (!rawValue) {
    return "";
  }
  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  const path = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
  return base ? `${base}${path}` : path;
}
