function parseMessage(message) {
  const raw = message.content.toString("utf8");
  const parsed = JSON.parse(raw);
  const assetId = Number(parsed.assetId || parsed.id || 0);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    throw new Error(`invalid media processing message: ${raw}`);
  }
  return assetId;
}

function variantObjectKey(originalObjectKey, kind) {
  const cleanKey = String(originalObjectKey || "image").replace(/^\/+/, "");
  const dotIndex = cleanKey.lastIndexOf(".");
  const stem = dotIndex > 0 ? cleanKey.slice(0, dotIndex) : cleanKey;
  return `${stem}/${String(kind).toLowerCase()}.webp`;
}

function publicUrl(objectKey, baseUrl = process.env.MEDIA_WORKER_PUBLIC_BASE_URL || "") {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
  if (!normalizedBaseUrl || !objectKey) {
    return "";
  }
  try {
    const parsed = new URL(normalizedBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      return "";
    }
  } catch {
    return "";
  }
  return `${normalizedBaseUrl}/${String(objectKey).replace(/^\/+/, "")}`;
}

function prometheusLabelValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function timestampSeconds(value) {
  const millis = Date.parse(value || "");
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : 0;
}

function formatPrometheusMetrics(state, config, now = Date.now()) {
  const queue = prometheusLabelValue(config.queue);
  const startedAtSeconds = timestampSeconds(state.startedAt);
  const uptimeSeconds = startedAtSeconds > 0
    ? Math.max(0, Math.floor(now / 1000) - startedAtSeconds)
    : 0;
  const lines = [
    "# HELP memesee_media_worker_ready Whether the media worker is ready to consume messages.",
    "# TYPE memesee_media_worker_ready gauge",
    `memesee_media_worker_ready{queue="${queue}"} ${state.ready && !state.shuttingDown ? 1 : 0}`,
    "# HELP memesee_media_worker_shutting_down Whether the media worker is shutting down.",
    "# TYPE memesee_media_worker_shutting_down gauge",
    `memesee_media_worker_shutting_down{queue="${queue}"} ${state.shuttingDown ? 1 : 0}`,
    "# HELP memesee_media_worker_processed_total Media processing messages completed successfully.",
    "# TYPE memesee_media_worker_processed_total counter",
    `memesee_media_worker_processed_total{queue="${queue}"} ${Number(state.processedCount || 0)}`,
    "# HELP memesee_media_worker_failed_total Media processing messages that failed.",
    "# TYPE memesee_media_worker_failed_total counter",
    `memesee_media_worker_failed_total{queue="${queue}"} ${Number(state.failedCount || 0)}`,
    "# HELP memesee_media_worker_uptime_seconds Media worker process uptime in seconds.",
    "# TYPE memesee_media_worker_uptime_seconds gauge",
    `memesee_media_worker_uptime_seconds{queue="${queue}"} ${uptimeSeconds}`,
    "# HELP memesee_media_worker_last_message_timestamp_seconds Unix timestamp of the last consumed media message.",
    "# TYPE memesee_media_worker_last_message_timestamp_seconds gauge",
    `memesee_media_worker_last_message_timestamp_seconds{queue="${queue}"} ${timestampSeconds(state.lastMessageAt)}`,
    "",
  ];
  return lines.join("\n");
}

module.exports = {
  formatPrometheusMetrics,
  parseMessage,
  publicUrl,
  variantObjectKey,
};
