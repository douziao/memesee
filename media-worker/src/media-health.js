const http = require("http");
const { formatPrometheusMetrics } = require("./media-utils");

async function getMediaWorkerHealthStatus({ state, config, db, redis, rabbitReady }) {
  let dbReady = false;
  try {
    await db.query("select 1");
    dbReady = true;
  } catch (error) {
    state.lastError = error.message;
  }

  const redisReady = !redis || redis.status === "ready";
  const healthy = !state.shuttingDown && Boolean(rabbitReady()) && dbReady && redisReady;

  return {
    status: healthy ? "UP" : "DOWN",
    ready: state.ready,
    shuttingDown: state.shuttingDown,
    rabbitReady: Boolean(rabbitReady()),
    dbReady,
    redisReady,
    queue: config.queue,
    concurrency: config.concurrency,
    processedCount: state.processedCount,
    failedCount: state.failedCount,
    lastMessageAt: state.lastMessageAt,
    lastError: state.lastError,
    startedAt: state.startedAt,
  };
}

function createMediaWorkerHealthServer({ state, config, db, redis, rabbitReady }) {
  return http.createServer(async (request, response) => {
    if (request.url === "/metrics") {
      response.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(formatPrometheusMetrics(state, config));
      return;
    }

    if (request.url !== "/healthz") {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ status: "NOT_FOUND" }));
      return;
    }

    const health = await getMediaWorkerHealthStatus({ state, config, db, redis, rabbitReady });
    response.writeHead(health.status === "UP" ? 200 : 503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(health));
  });
}

function startMediaWorkerHealthServer({ state, config, db, redis, rabbitReady, onStarted }) {
  const server = createMediaWorkerHealthServer({ state, config, db, redis, rabbitReady });
  server.listen(config.healthPort, "0.0.0.0", () => {
    if (onStarted) {
      onStarted(config.healthPort);
    }
  });
  return server;
}

module.exports = {
  createMediaWorkerHealthServer,
  getMediaWorkerHealthStatus,
  startMediaWorkerHealthServer,
};
