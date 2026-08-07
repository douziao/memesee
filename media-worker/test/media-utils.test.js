const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  formatPrometheusMetrics,
  parseMessage,
  publicUrl,
  variantObjectKey,
} = require("../src/media-utils");

function message(payload) {
  return {
    content: Buffer.from(JSON.stringify(payload), "utf8"),
  };
}

describe("parseMessage", () => {
  it("accepts assetId messages", () => {
    assert.equal(parseMessage(message({ assetId: 42 })), 42);
  });

  it("accepts legacy id messages", () => {
    assert.equal(parseMessage(message({ id: "43" })), 43);
  });

  it("rejects invalid asset ids", () => {
    assert.throws(() => parseMessage(message({ assetId: 0 })), /invalid media processing message/);
    assert.throws(() => parseMessage(message({ assetId: "abc" })), /invalid media processing message/);
  });
});

describe("variantObjectKey", () => {
  it("creates stable webp variant keys next to the original object", () => {
    assert.equal(variantObjectKey("posts/2026/original.jpeg", "DISPLAY"), "posts/2026/original/display.webp");
  });

  it("normalizes leading slashes and extensionless originals", () => {
    assert.equal(variantObjectKey("/uploads/avatar", "THUMB"), "uploads/avatar/thumb.webp");
  });
});

describe("publicUrl", () => {
  it("joins normalized media base urls and object keys", () => {
    assert.equal(
      publicUrl("/posts/asset/display.webp", "https://memesee.world/media/"),
      "https://memesee.world/media/posts/asset/display.webp",
    );
  });

  it("returns an empty string when the base url or object key is missing", () => {
    assert.equal(publicUrl("posts/asset/display.webp", ""), "");
    assert.equal(publicUrl("", "https://memesee.world/media"), "");
  });

  it("rejects non-web and credentialed media base urls", () => {
    assert.equal(publicUrl("posts/asset/display.webp", "javascript:alert(1)"), "");
    assert.equal(publicUrl("posts/asset/display.webp", "file:///tmp/media"), "");
    assert.equal(publicUrl("posts/asset/display.webp", "https://user:pass@memesee.world/media"), "");
    assert.equal(publicUrl("posts/asset/display.webp", "not a url"), "");
  });
});

describe("formatPrometheusMetrics", () => {
  it("exports ready, shutdown, processing counters and timestamps", () => {
    const metrics = formatPrometheusMetrics(
      {
        ready: true,
        shuttingDown: false,
        processedCount: 12,
        failedCount: 2,
        startedAt: "2026-06-07T10:00:00.000Z",
        lastMessageAt: "2026-06-07T10:01:30.000Z",
      },
      { queue: 'memesee.media."variant"\nprocessing' },
      Date.parse("2026-06-07T10:02:00.000Z"),
    );
    const queueLabel = 'queue="memesee.media.\\"variant\\"\\nprocessing"';

    assert.match(metrics, /# TYPE memesee_media_worker_ready gauge/);
    assert.ok(metrics.includes(`memesee_media_worker_ready{${queueLabel}} 1`));
    assert.ok(metrics.includes(`memesee_media_worker_processed_total{${queueLabel}} 12`));
    assert.ok(metrics.includes(`memesee_media_worker_failed_total{${queueLabel}} 2`));
    assert.ok(metrics.includes(`memesee_media_worker_uptime_seconds{${queueLabel}} 120`));
    assert.ok(metrics.includes(`memesee_media_worker_last_message_timestamp_seconds{${queueLabel}} 1780826490`));
  });

  it("marks the worker unready while shutting down", () => {
    const metrics = formatPrometheusMetrics(
      {
        ready: true,
        shuttingDown: true,
        processedCount: 0,
        failedCount: 0,
        startedAt: "",
        lastMessageAt: "",
      },
      { queue: "memesee.media.variant-processing" },
    );

    assert.match(metrics, /memesee_media_worker_ready\{queue="memesee\.media\.variant-processing"\} 0/);
    assert.match(metrics, /memesee_media_worker_shutting_down\{queue="memesee\.media\.variant-processing"\} 1/);
  });
});
