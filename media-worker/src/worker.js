const amqp = require("amqplib");
const mysql = require("mysql2/promise");
const { Client: MinioClient } = require("minio");
const sharp = require("sharp");
const Redis = require("ioredis");
const { parseMessage, publicUrl, variantObjectKey } = require("./media-utils");
const { startMediaWorkerHealthServer } = require("./media-health");

const VARIANTS = [
  { kind: "THUMB", maxEdge: 480, quality: 78 },
  { kind: "SMALL", maxEdge: 720, quality: 80 },
  { kind: "MEDIUM", maxEdge: 1080, quality: 82 },
  { kind: "DISPLAY", maxEdge: 1600, quality: 84 },
];

const config = {
  rabbitUrl: env("MEDIA_WORKER_RABBITMQ_URL", "amqp://memesee:memesee_password@127.0.0.1:5672"),
  exchange: env("MEDIA_WORKER_EXCHANGE", "memesee.media"),
  queue: env("MEDIA_WORKER_QUEUE", "memesee.media.variant-processing"),
  routingKey: env("MEDIA_WORKER_ROUTING_KEY", "media.variant.process"),
  deadLetterExchange: env("MEDIA_WORKER_DEAD_LETTER_EXCHANGE", "memesee.media.dlx"),
  deadLetterQueue: env("MEDIA_WORKER_DEAD_LETTER_QUEUE", "memesee.media.variant-processing.dlq"),
  deadLetterRoutingKey: env("MEDIA_WORKER_DEAD_LETTER_ROUTING_KEY", "media.variant.process.dead"),
  concurrency: Number(env("MEDIA_WORKER_CONCURRENCY", "2")),
  healthPort: Number(env("MEDIA_WORKER_HEALTH_PORT", "8088")),
  mysql: {
    host: env("MEDIA_WORKER_DB_HOST", "127.0.0.1"),
    port: Number(env("MEDIA_WORKER_DB_PORT", "3307")),
    user: env("MEDIA_WORKER_DB_USERNAME", "memesee_app"),
    password: env("MEDIA_WORKER_DB_PASSWORD", "memesee_app_password"),
    database: env("MEDIA_WORKER_DB_NAME", "memesee_content"),
    waitForConnections: true,
    connectionLimit: Number(env("MEDIA_WORKER_DB_POOL", "5")),
  },
  minio: {
    endPoint: env("MEDIA_WORKER_MINIO_ENDPOINT", "127.0.0.1"),
    port: Number(env("MEDIA_WORKER_MINIO_PORT", "9000")),
    useSSL: env("MEDIA_WORKER_MINIO_USE_SSL", "false") === "true",
    accessKey: env("MEDIA_WORKER_MINIO_ACCESS_KEY", "minioadmin"),
    secretKey: env("MEDIA_WORKER_MINIO_SECRET_KEY", "minioadmin"),
  },
  bucket: env("MEDIA_WORKER_MINIO_BUCKET", "memesee-post-images"),
  redisUrl: env("MEDIA_WORKER_REDIS_URL", ""),
};

const db = mysql.createPool(config.mysql);
const minio = new MinioClient(config.minio);
const redis = config.redisUrl ? new Redis(config.redisUrl) : null;

const state = {
  startedAt: new Date().toISOString(),
  ready: false,
  shuttingDown: false,
  processedCount: 0,
  failedCount: 0,
  lastMessageAt: "",
  lastError: "",
};

let amqpConnection = null;
let amqpChannel = null;
let consumerTag = "";
let healthServer = null;

function env(name, fallback) {
  return process.env[name] || fallback;
}

function logEvent(level, event, fields = {}) {
  const payload = {
    event,
    service: "media-worker",
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function exitForRabbitMqTopologyLoss(component) {
  if (state.shuttingDown) {
    return;
  }
  state.ready = false;
  state.lastError = `${component} closed`;
  logEvent("error", "media_worker_rabbitmq_topology_lost", {
    component,
    queue: config.queue,
  });
  setTimeout(() => process.exit(1), 250);
}

function startHealthServer() {
  healthServer = startMediaWorkerHealthServer({
    state,
    config,
    db,
    redis,
    rabbitReady: () => Boolean(amqpConnection && amqpChannel && consumerTag && state.ready),
    onStarted: (port) => logEvent("info", "media_worker_health_server_started", { port }),
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function loadAsset(assetId) {
  const [rows] = await db.query(
    `select id, kind, bucket_name as bucketName, object_key as objectKey,
            original_filename as originalFilename, content_type as contentType,
            size_bytes as sizeBytes, status, processing_status as processingStatus, blur_data_url as blurDataUrl
       from media_assets
      where id = ?`,
    [assetId],
  );
  return rows[0] || null;
}

async function downloadOriginal(asset) {
  const stream = await minio.getObject(asset.bucketName || config.bucket, asset.objectKey);
  return streamToBuffer(stream);
}

async function buildBlurDataUrl(originalBuffer) {
  const output = await sharp(originalBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: 24, height: 24, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 35, effort: 2 })
    .toBuffer();
  return "data:image/webp;base64," + output.toString("base64");
}

async function putVariant(asset, kind, body) {
  const objectKey = kind === "ORIGINAL" ? asset.objectKey : variantObjectKey(asset.objectKey, kind);
  if (kind !== "ORIGINAL") {
    await minio.putObject(asset.bucketName || config.bucket, objectKey, body, body.length, {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  }
  return objectKey;
}

async function upsertVariant(conn, asset, variant) {
  await conn.execute(
    `insert into media_asset_variants
       (media_asset_id, kind, bucket_name, object_key, content_type, size_bytes, width, height)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on duplicate key update
       bucket_name = values(bucket_name),
       object_key = values(object_key),
       content_type = values(content_type),
       size_bytes = values(size_bytes),
       width = values(width),
       height = values(height)`,
    [
      asset.id,
      variant.kind,
      asset.bucketName || config.bucket,
      variant.objectKey,
      variant.contentType,
      variant.sizeBytes,
      variant.width,
      variant.height,
    ],
  );
}

async function buildResponseForAsset(assetId) {
  const [assetRows] = await db.query(
    `select id, kind, bucket_name as bucketName, object_key as objectKey,
            original_filename as originalFilename, content_type as contentType,
            size_bytes as sizeBytes, processing_status as processingStatus, blur_data_url as blurDataUrl
       from media_assets
      where id = ? and status = 'ACTIVE'`,
    [assetId],
  );
  const asset = assetRows[0];
  if (!asset) {
    return null;
  }
  const [variantRows] = await db.query(
    `select kind, bucket_name as bucketName, object_key as objectKey,
            content_type as contentType, size_bytes as sizeBytes, width, height
       from media_asset_variants
      where media_asset_id = ?`,
    [assetId],
  );
  const variants = variantRows.map((variant) => ({
    kind: variant.kind,
    url: publicUrl(variant.objectKey),
    contentType: variant.contentType,
    sizeBytes: Number(variant.sizeBytes || 0),
    width: Number(variant.width || 0),
    height: Number(variant.height || 0),
  }));
  const byKind = Object.fromEntries(variants.map((variant) => [variant.kind, variant]));
  const originalUrl = byKind.ORIGINAL?.url || publicUrl(asset.objectKey);
  const displayUrl = byKind.DISPLAY?.url || originalUrl;
  const mediumUrl = byKind.MEDIUM?.url || displayUrl;
  const smallUrl = byKind.SMALL?.url || mediumUrl;
  const thumbUrl = byKind.THUMB?.url || smallUrl;
  const original = byKind.ORIGINAL;
  return {
    id: Number(asset.id),
    kind: asset.kind,
    url: displayUrl,
    thumbUrl,
    smallUrl,
    mediumUrl,
    displayUrl,
    originalUrl,
    contentType: original?.contentType || asset.contentType,
    originalFilename: asset.originalFilename,
    sizeBytes: Number(original?.sizeBytes || asset.sizeBytes || 0),
    width: Number(original?.width || 0),
    height: Number(original?.height || 0),
    processingStatus: asset.processingStatus || "READY",
    blurDataUrl: asset.blurDataUrl || "",
    variants,
  };
}

async function refreshLinkedFeedMedia(assetId) {
  const [links] = await db.query(
    `select distinct main_post_id as mainPostId
       from main_post_media_links
      where media_asset_id = ?`,
    [assetId],
  );
  for (const link of links) {
    const [linkedAssets] = await db.query(
      `select media_asset_id as assetId
         from main_post_media_links
        where main_post_id = ?
        order by sort_order asc, id asc`,
      [link.mainPostId],
    );
    const responses = [];
    for (const linkedAsset of linkedAssets) {
      const response = await buildResponseForAsset(linkedAsset.assetId);
      if (response) {
        responses.push(response);
      }
    }
    await db.execute(
      `update main_post_feed_items set media_assets_json = ? where main_post_id = ?`,
      [JSON.stringify(responses), link.mainPostId],
    );
  }
}

async function evictCaches(assetId) {
  if (!redis) {
    return;
  }
  const [mainLinks] = await db.query(
    `select distinct main_post_id as id from main_post_media_links where media_asset_id = ?`,
    [assetId],
  );
  const [subLinks] = await db.query(
    `select distinct sub_post_id as id from sub_post_media_links where media_asset_id = ?`,
    [assetId],
  );
  const keys = [`memesee:content:media-asset-metadata:${assetId}:detail`];
  keys.push(...mainLinks.map((link) => `memesee:content:main-post-media:${link.id}:attachments`));
  keys.push(...subLinks.map((link) => `memesee:content:sub-post-media:${link.id}:attachments`));
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  const stream = redis.scanStream({ match: "memesee:content:main-post-feed-page:*", count: 100 });
  const feedKeys = [];
  for await (const batch of stream) {
    feedKeys.push(...batch);
    if (feedKeys.length >= 100) {
      await redis.del(...feedKeys.splice(0, feedKeys.length));
    }
  }
  if (feedKeys.length > 0) {
    await redis.del(...feedKeys);
  }
}

async function processAsset(assetId) {
  const asset = await loadAsset(assetId);
  if (!asset || asset.status !== "ACTIVE" || asset.kind !== "IMAGE") {
    return;
  }
  const originalBuffer = await downloadOriginal(asset);
  const originalMetadata = await sharp(originalBuffer, { failOn: "none" }).metadata();
  const blurDataUrl = await buildBlurDataUrl(originalBuffer);
  const generated = [{
    kind: "ORIGINAL",
    objectKey: asset.objectKey,
    contentType: asset.contentType,
    sizeBytes: Number(asset.sizeBytes || originalBuffer.length),
    width: Number(originalMetadata.width || 0),
    height: Number(originalMetadata.height || 0),
  }];

  for (const variant of VARIANTS) {
    const output = await sharp(originalBuffer, { failOn: "none" })
      .rotate()
      .resize({
        width: variant.maxEdge,
        height: variant.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: variant.quality, effort: 5 })
      .toBuffer({ resolveWithObject: true });
    const objectKey = await putVariant(asset, variant.kind, output.data);
    generated.push({
      kind: variant.kind,
      objectKey,
      contentType: "image/webp",
      sizeBytes: output.data.length,
      width: Number(output.info.width || 0),
      height: Number(output.info.height || 0),
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const variant of generated) {
      await upsertVariant(conn, asset, variant);
    }
    await conn.execute(
      `update media_assets set processing_status = 'READY', blur_data_url = ? where id = ?`,
      [blurDataUrl, asset.id],
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  await refreshLinkedFeedMedia(asset.id);
  await evictCaches(asset.id);
}

async function markFailed(assetId, error) {
  logEvent("error", "media_variant_processing_failed", { assetId, message: error.message });
  await db.execute(
    `update media_assets set processing_status = 'FAILED' where id = ?`,
    [assetId],
  );
  await evictCaches(assetId);
}

async function ensureQueueTopology(channel) {
  await channel.assertExchange(config.deadLetterExchange, "direct", { durable: true });
  await channel.assertQueue(config.deadLetterQueue, { durable: true });
  await channel.bindQueue(config.deadLetterQueue, config.deadLetterExchange, config.deadLetterRoutingKey);

  await channel.assertExchange(config.exchange, "direct", { durable: true });
  await channel.assertQueue(config.queue, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": config.deadLetterExchange,
      "x-dead-letter-routing-key": config.deadLetterRoutingKey,
    },
  });
  await channel.bindQueue(config.queue, config.exchange, config.routingKey);
}

async function main() {
  startHealthServer();
  amqpConnection = await amqp.connect(config.rabbitUrl);
  amqpConnection.on("error", (error) => {
    state.lastError = error.message;
    logEvent("error", "media_worker_rabbitmq_error", { message: error.message });
  });
  amqpConnection.on("close", () => {
    exitForRabbitMqTopologyLoss("connection");
  });

  amqpChannel = await amqpConnection.createChannel();
  amqpChannel.on("error", (error) => {
    state.lastError = error.message;
    logEvent("error", "media_worker_channel_error", { message: error.message });
  });
  amqpChannel.on("close", () => {
    exitForRabbitMqTopologyLoss("channel");
  });
  await ensureQueueTopology(amqpChannel);
  amqpChannel.prefetch(Math.max(1, config.concurrency));
  const consumer = await amqpChannel.consume(config.queue, async (message) => {
    if (!message) {
      return;
    }
    let assetId = 0;
    try {
      assetId = parseMessage(message);
      state.lastMessageAt = new Date().toISOString();
      await processAsset(assetId);
      state.processedCount += 1;
      amqpChannel.ack(message);
    } catch (error) {
      state.failedCount += 1;
      state.lastError = error.message;
      if (assetId > 0) {
        await markFailed(assetId, error);
      }
      amqpChannel.nack(message, false, false);
    }
  });
  consumerTag = consumer.consumerTag;
  state.ready = true;
  logEvent("info", "media_worker_started", { queue: config.queue, concurrency: config.concurrency });
}

async function shutdown(signal) {
  if (state.shuttingDown) {
    return;
  }
  state.shuttingDown = true;
  state.ready = false;
  logEvent("info", "media_worker_shutdown_started", { signal });

  try {
    if (amqpChannel && consumerTag) {
      await amqpChannel.cancel(consumerTag);
    }
  } catch (error) {
    logEvent("warn", "media_worker_consumer_cancel_failed", { message: error.message });
  }
  try {
    if (amqpChannel) {
      await amqpChannel.close();
    }
  } catch (error) {
    logEvent("warn", "media_worker_channel_close_failed", { message: error.message });
  }
  try {
    if (amqpConnection) {
      await amqpConnection.close();
    }
  } catch (error) {
    logEvent("warn", "media_worker_connection_close_failed", { message: error.message });
  }
  try {
    if (redis) {
      redis.disconnect();
    }
  } catch (error) {
    logEvent("warn", "media_worker_redis_close_failed", { message: error.message });
  }
  try {
    await db.end();
  } catch (error) {
    logEvent("warn", "media_worker_db_close_failed", { message: error.message });
  }
  await new Promise((resolve) => {
    if (!healthServer) {
      resolve();
      return;
    }
    healthServer.close(() => resolve());
  });
  logEvent("info", "media_worker_shutdown_finished", { signal });
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((error) => {
  state.lastError = error.message;
  logEvent("error", "media_worker_start_failed", { message: error.message });
  process.exit(1);
});
