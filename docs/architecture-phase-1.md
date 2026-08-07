# Memesee Architecture Phase 1

## Current Service Boundaries

Memesee keeps the first-stage architecture intentionally conservative:

- `frontend` serves the React SPA from Nginx and calls only `/api/*` through the gateway.
- `gateway-service` owns external API routing, CORS, request correlation, downstream timeouts, retry, circuit breaker, and fallback responses.
- `user-service` owns identity, auth, user progress, invite codes, and user-side activity state.
- `content-service` owns communities, main posts, sub posts, feed projections, media metadata, notifications, search indexing, and content-side outbox processing.
- `media-worker` owns asynchronous image variant generation, blur placeholders, feed media refresh, cache eviction, and worker health/metrics.
- MySQL remains split by schema (`memesee_user`, `memesee_content`) to keep ownership boundaries clear.
- Redis provides distributed cache, single-flight/refresh coordination, worker cache eviction, and content outbox locking.
- RabbitMQ carries asynchronous media variant jobs with a durable DLQ.
- MinIO stores original and generated media objects with immutable cache metadata.
- Meilisearch serves the content search index.
- Prometheus scrapes gateway, user-service, content-service, and media-worker metrics.
- Nginx terminates public traffic, forwards `/api/` to the gateway, and serves `/media/` with immutable cache and Range support.
- `docker-compose.prod.yml` is the current production deployment contract and keeps public service ports bound to localhost by default.

## First-Stage Upgrade Decisions

The first-stage upgrade avoids service splits and data migrations. It adds service governance around the existing architecture:

- Gateway downstream calls have configurable connect timeout, response timeout, GET retry, circuit breaker, and a traceable `503` fallback.
- `X-Request-Id` and valid W3C `traceparent` are relayed by the gateway, surfaced in downstream responses, and logged as structured key/value fields.
- The media worker exits on unexpected RabbitMQ connection/channel close so Compose restart policy restores consumption instead of leaving an unready process alive.
- The media worker emits JSON event logs for worker lifecycle, RabbitMQ failure, shutdown, and media processing failure events.
- Production configuration exposes gateway retry/circuit-breaker knobs through `.env` and Compose environment variables.
- CI has static architecture checks so gateway governance, request correlation, media-worker reliability hooks, and architecture documentation cannot silently regress.

## Cache Layering

The first-stage cache strategy keeps caching close to existing ownership boundaries:

- Browser and frontend Nginx cache immutable hashed assets.
- Public `/media/` delivery uses Nginx immutable cache headers and Range support for generated media objects.
- Redis remains the shared backend cache for feed/detail projections, single-flight refresh coordination, worker cache eviction, and outbox locking.
- Application caches stay service-owned; cache keys must not cross user/content schema ownership boundaries.
- Prometheus cache metrics are the first alerting surface for hit-rate drops, eviction spikes, and backend refresh pressure.

## Database Hotspots And Index Governance

The first-stage DB work keeps MySQL schemas unchanged while making high-traffic reads observable and index-backed:

- `memesee_user` and `memesee_content` remain separate schemas with service-local Flyway migrations.
- Feed, author sort, media link, and asset lookup paths are governed by explicit migrations and index verification scripts.
- Projection query timers and slow-threshold metrics identify read hotspots before adding new denormalized tables.
- Hikari pool limits are exposed through production configuration so saturation can be tuned per service.
- Future write scaling should start with command/query separation inside `content-service`, not a premature service split.

## Failure Isolation

Gateway routing keeps the backend blast radius bounded:

- `GATEWAY_HTTPCLIENT_CONNECT_TIMEOUT_MS` limits connection establishment.
- `GATEWAY_HTTPCLIENT_RESPONSE_TIMEOUT` caps downstream response wait.
- `GATEWAY_RETRY_*` retries only idempotent `GET` requests for transient gateway/downstream failures.
- `GATEWAY_CIRCUIT_BREAKER_*` opens the downstream circuit after sustained failures.
- `/__gateway/fallback` returns `503` with `event=gateway_downstream_unavailable`, `requestId`, and optional `traceId`.

Media processing isolation keeps asynchronous work recoverable:

- RabbitMQ queue/exchange/DLQ topology is declared on worker start.
- Failed messages are rejected to the configured DLQ.
- Unexpected RabbitMQ topology loss exits the worker; Compose restarts it with the same durable queue.

## Observability And OpenTelemetry Path

The current first-stage implementation is OpenTelemetry-ready without requiring a collector yet:

- `traceparent` is accepted, validated, relayed, returned, and logged.
- `X-Request-Id` remains the operational correlation id for logs and support.
- Java service console logs include `requestId` and `traceId` MDC fields.
- Media-worker lifecycle and failure logs are emitted as JSON event records.
- Prometheus already captures HTTP histograms, projection query metrics, cache metrics, and media-worker metrics.
- A later OpenTelemetry phase can add Java agent or Micrometer tracing and a collector without changing API contracts.

## Deployment Evolution

Compose remains the production baseline for this stage:

- Services have readiness health checks and dependency ordering.
- Core containers run with `no-new-privileges`.
- Backend and media-worker containers run as non-root users.
- Nginx and frontend runtime checks validate gzip, immutable caching, and media Range support.

Blue/green or rolling deployment can be added later by running a second Compose project with alternate host ports, validating it with `verify-production-runtime.ps1`, and switching the host Nginx upstreams after validation.

Rollback remains image and configuration based for this stage:

- Keep the previous Compose project or image tags available until the new project passes runtime verification.
- Revert host Nginx upstreams to the previous gateway/frontend ports if validation fails after a cutover.
- Reapply the previous `.env` values for gateway retry/circuit-breaker knobs before restarting services when a configuration change is the suspected cause.
- Avoid destructive database rollback; schema migrations in this stage are additive indexes, so rollback should restore the previous application image while keeping the added indexes.
