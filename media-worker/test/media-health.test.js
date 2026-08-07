const assert = require("node:assert/strict");
const http = require("node:http");
const { describe, it } = require("node:test");
const { createMediaWorkerHealthServer, getMediaWorkerHealthStatus } = require("../src/media-health");

function state(overrides = {}) {
  return {
    startedAt: "2026-06-07T10:00:00.000Z",
    ready: true,
    shuttingDown: false,
    processedCount: 3,
    failedCount: 1,
    lastMessageAt: "2026-06-07T10:01:00.000Z",
    lastError: "",
    ...overrides,
  };
}

function config(overrides = {}) {
  return {
    queue: "memesee.media.variant-processing",
    concurrency: 2,
    healthPort: 0,
    ...overrides,
  };
}

function request(server, path) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    http.get({ hostname: "127.0.0.1", port, path }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body,
        });
      });
    }).on("error", reject);
  });
}

async function withServer(server, action) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await action(server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("getMediaWorkerHealthStatus", () => {
  it("reports all dependency readiness fields", async () => {
    const currentState = state();
    const health = await getMediaWorkerHealthStatus({
      state: currentState,
      config: config(),
      db: { query: async () => [] },
      redis: { status: "ready" },
      rabbitReady: () => true,
    });

    assert.equal(health.status, "UP");
    assert.equal(health.rabbitReady, true);
    assert.equal(health.dbReady, true);
    assert.equal(health.redisReady, true);
    assert.equal(health.queue, "memesee.media.variant-processing");
    assert.equal(health.concurrency, 2);
  });

  it("returns DOWN and records the database error when the db probe fails", async () => {
    const currentState = state();
    const health = await getMediaWorkerHealthStatus({
      state: currentState,
      config: config(),
      db: { query: async () => { throw new Error("db unavailable"); } },
      redis: { status: "ready" },
      rabbitReady: () => true,
    });

    assert.equal(health.status, "DOWN");
    assert.equal(health.dbReady, false);
    assert.equal(health.lastError, "db unavailable");
    assert.equal(currentState.lastError, "db unavailable");
  });
});

describe("createMediaWorkerHealthServer", () => {
  it("serves no-store JSON health responses", async () => {
    const server = createMediaWorkerHealthServer({
      state: state(),
      config: config(),
      db: { query: async () => [] },
      redis: null,
      rabbitReady: () => true,
    });

    await withServer(server, async () => {
      const response = await request(server, "/healthz");
      const body = JSON.parse(response.body);

      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"], /application\/json/);
      assert.equal(response.headers["cache-control"], "no-store");
      assert.equal(body.status, "UP");
      assert.equal(body.redisReady, true);
    });
  });

  it("serves no-store prometheus metrics without probing dependencies", async () => {
    let dbProbeCount = 0;
    const server = createMediaWorkerHealthServer({
      state: state(),
      config: config(),
      db: { query: async () => { dbProbeCount += 1; } },
      redis: null,
      rabbitReady: () => false,
    });

    await withServer(server, async () => {
      const response = await request(server, "/metrics");

      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"], /text\/plain/);
      assert.equal(response.headers["cache-control"], "no-store");
      assert.match(response.body, /memesee_media_worker_ready\{queue="memesee\.media\.variant-processing"\} 1/);
      assert.equal(dbProbeCount, 0);
    });
  });
});
