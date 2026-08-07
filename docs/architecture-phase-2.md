# Memesee Architecture Phase 2

## Scope

Phase 2 builds on the Phase 1 gateway, observability, and Compose production baseline without splitting services or rewriting business flows.

The delivered scope is:

- OpenTelemetry tracing for `gateway-service`, `user-service`, and `content-service`.
- A local OTel Collector deployment target for OTLP HTTP/gRPC trace ingestion.
- Blue/green Compose deployment support with per-color container prefixes and host ports.
- Automated rollback to the previously verified color.
- Cache hit-rate alerting as a production guardrail.
- Database hotspot dashboard evidence for projection query latency and Hikari pressure.
- RabbitMQ DLQ inspection, peek, replay, and purge tooling.

## OpenTelemetry Tracing

Java services use Micrometer Tracing with the OpenTelemetry bridge and OTLP exporter. The production configuration is controlled through:

- `MANAGEMENT_TRACING_ENABLED`
- `MANAGEMENT_TRACING_SAMPLING_PROBABILITY`
- `MANAGEMENT_OTLP_TRACING_ENDPOINT`

`docker-compose.prod.yml` runs `otel-collector` and points Java services to `http://otel-collector:4318/v1/traces`. The collector currently exports to the debug exporter so the deployment can validate trace flow without requiring a vendor backend. A later phase can replace or add exporters for Tempo, Jaeger, Honeycomb, Datadog, or another tracing backend without changing application code.

## Blue/Green Deployment

Blue/green deployment is enabled by parameterizing Compose container names through `COMPOSE_CONTAINER_PREFIX`. This allows two Compose projects to run on one host without container-name collisions.

`scripts/deploy-bluegreen.ps1` generates a target color env file under `deploy/.generated`, starts the target Compose project on alternate host ports, runs `verify-production-runtime.ps1`, and optionally promotes the target by updating the configured Nginx site upstream ports.

The target color must pass runtime verification before promotion:

- gateway API health
- frontend health
- Prometheus readiness and scrape target health
- API metrics
- projection query metrics
- media-worker metrics
- frontend immutable cache and gzip checks

## Rollback

`scripts/rollback-bluegreen.ps1` reads `deploy/bluegreen-state.json`, ensures the previous color is running, verifies runtime health, and optionally switches Nginx back to the previous gateway/frontend/media ports. It can stop the rolled-back project after cutback when `-StopRolledBackProject` is supplied.

Rollback is image and configuration based. Database migrations in this architecture stage remain additive; rollback restores application routing to the previous verified runtime rather than attempting destructive schema rollback.

## Cache Hit-Rate Alerting

`deploy/prometheus/alert-rules.yml` includes `MemeseeCacheHitRateLow`, which alerts when cache hit rate stays below 60% while cache traffic is present. The runtime verifier can also enforce a cache hit-rate budget with `-VerifyCacheMetrics` and `-MinCacheHitRatePercent`.

## Database Hotspot Dashboard

`deploy/prometheus/dashboards/memesee-db-hotspots.json` captures the current database hotspot evidence without introducing a MySQL exporter dependency:

- projection query p95 latency
- projection slow query rate
- Hikari active connections
- Hikari pending connections
- top projection query volume

These panels focus optimization on the read paths already instrumented by `content-service`.

## Share HTML Dashboard

`deploy/prometheus/dashboards/memesee-share-html.json` tracks crawler-facing share preview health:

- share HTML render rate by target, outcome, and image source
- share HTML p95 render duration
- default OG image fallback ratio
- sub-post fallback ratio
- top share HTML outcomes

These panels keep the share/deep-link path observable after crawler-specific `/posts/:id` HTML routing is enabled.

## RabbitMQ DLQ Operations

`scripts/rabbitmq-dlq.ps1` supports:

- `Inspect`: summarize DLQ depth and state
- `Peek`: sample messages with requeue-on-read
- `Requeue`: replay messages from the DLQ to the media exchange
- `Purge`: permanently clear the DLQ

`Requeue` and `Purge` require `-ConfirmDestructive` so routine inspection cannot accidentally remove messages.

## Verification Contract

The Phase 2 static verifier checks:

- OTel dependencies and configuration in all Java services
- OTel Collector Compose and Prometheus scrape wiring
- container-name prefix support for blue/green
- blue/green and rollback scripts
- DLQ script safety gates
- cache hit-rate alert
- database hotspot dashboard PromQL
- production env keys
- CI wiring

Runtime evidence should include backend tests, Compose config rendering, Prometheus config validation, a production runtime verification run, and at least one OTel Collector metrics query after gateway traffic.
