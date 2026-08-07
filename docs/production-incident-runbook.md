# MemeSee Production Incident Runbook

This runbook is for first-response operations after production launch. It intentionally avoids printing secrets. When a command needs credentials, pass them through the production `.env` or environment variables, not through shared chat logs.

## First Response

1. Preserve evidence before changing state:

```powershell
.\scripts\verify-production-preflight.ps1 -EnvFile .env -OutputFile incident-preflight.json
.\scripts\verify-production-env-report.ps1 -EnvFile .env -Json
.\scripts\verify-production-launch.ps1 -FromEnvFile .env -PrintCommand
```

2. Check whether the public runtime is still healthy:

```powershell
.\scripts\verify-production-launch.ps1 -FromEnvFile .env
```

3. If the launch verifier fails, capture the failing section, then decide whether to roll back, disable a verification feature, or keep serving the current version while investigating.

4. Never paste `.env`, tokens, passwords, cookies, JWTs, object storage keys, RabbitMQ credentials, or MinIO credentials into issue trackers or chat. Use the redacted report only.

Scripts that can change production state must write audit JSON with `AuditSchemaVersion`, `Status`, and `Safety` fields. Treat `Status=CLEANUP_FAILED` or any failed cleanup entry as unresolved production residue until the listed temporary data is removed or verified harmless.

## Post-Launch Monitoring

After a deploy, keep a short monitoring window instead of relying on one successful launch verification. The default checkpoints are immediate, 5 minutes, 15 minutes, and 60 minutes:

```powershell
.\scripts\verify-production-post-launch.ps1 -FromEnvFile .env -OutputFile post-launch-monitoring.json
```

To inspect the schedule without waiting or touching live services:

```powershell
.\scripts\verify-production-post-launch.ps1 -FromEnvFile .env -Plan
```

Enable direct DLQ inspection only when RabbitMQ management credentials are available in `.env`:

```powershell
.\scripts\verify-production-post-launch.ps1 -FromEnvFile .env -InspectDlq -OutputFile post-launch-monitoring.json
```

Keep `DEPLOY_VERIFY_CONTENT_COMMAND_METRIC_DEFINITIONS=true` enabled so launch verification confirms the content command telemetry meters are discoverable without creating production posts. After production has real create/update/delete traffic, set `DEPLOY_VERIFY_CONTENT_COMMAND_METRICS=true` to make launch verification require non-startup `memesee_content_command_*` Prometheus samples.

To create a short-lived command metric sample with a test account, inspect the plan first:

```powershell
.\scripts\prime-content-command-metrics.ps1 -GatewayUrl http://127.0.0.1:8080 -CommunitySlug daily -Plan -AuditFile content-command-sample-plan.json
```

Then run it only with a dedicated low-privilege test user's token. Pass the token through `MEMESEE_CONTENT_COMMAND_SAMPLE_TOKEN` or `-AuthToken`; never paste it into shared logs:

```powershell
.\scripts\prime-content-command-metrics.ps1 -GatewayUrl http://127.0.0.1:8080 -PrometheusUrl http://127.0.0.1:9090 -CommunitySlug daily -VerifyPrometheusMetrics -ConfirmDestructive -AuditFile content-command-sample-audit.json
```

If any checkpoint fails, preserve `post-launch-monitoring.json`, run the preflight command from First Response, and choose rollback or targeted repair based on the failed section.

## Blue/Green Deploy

Before starting a candidate environment, inspect the generated env file path, port overrides, Compose command, runtime verification command, and Nginx routing impact:

```powershell
.\scripts\deploy-bluegreen.ps1 -EnvFile .env -TargetColor green -ActiveColor blue -Plan -AuditFile incident-deploy-plan.json
```

Run the deployment with an audit file so the candidate project, generated env file, verification URLs, state-file write, and optional Nginx promotion are captured:

```powershell
.\scripts\deploy-bluegreen.ps1 -EnvFile .env -TargetColor green -ActiveColor blue -AuditFile incident-deploy-audit.json
```

When promoting immediately, include the Nginx site path explicitly and review the plan before reloading Nginx:

```powershell
.\scripts\deploy-bluegreen.ps1 -EnvFile .env -TargetColor green -ActiveColor blue -Promote -NginxSitePath deploy\nginx\memesee.world.ssl.conf -ReloadNginx -Plan -AuditFile incident-deploy-plan.json
.\scripts\deploy-bluegreen.ps1 -EnvFile .env -TargetColor green -ActiveColor blue -Promote -NginxSitePath deploy\nginx\memesee.world.ssl.conf -ReloadNginx -AuditFile incident-deploy-audit.json
```

## Rollback

Use rollback when the active release causes user-visible errors, broken navigation, failed share previews, failed media delivery, or sustained API instability.

Before rollback:

```powershell
Get-Content deploy\bluegreen-state.json
.\scripts\verify-production-env-report.ps1 -EnvFile .env
```

Rollback without switching Nginx first:

```powershell
.\scripts\rollback-bluegreen.ps1 -Plan
.\scripts\rollback-bluegreen.ps1 -AuditFile incident-rollback-audit.json
```

Rollback and switch the outer Nginx upstreams when the site config path is available:

```powershell
.\scripts\rollback-bluegreen.ps1 -NginxSitePath deploy\nginx\memesee.world.ssl.conf -ReloadNginx -Plan
.\scripts\rollback-bluegreen.ps1 -NginxSitePath deploy\nginx\memesee.world.ssl.conf -ReloadNginx -AuditFile incident-rollback-audit.json
```

After rollback:

```powershell
.\scripts\verify-production-launch.ps1 -FromEnvFile .env
.\scripts\verify-release-readiness.ps1 -SkipDockerRuntime
```

Keep the rolled-back project running until the new active version has been stable long enough to inspect logs and compare metrics. Stop it only after evidence is collected:

```powershell
.\scripts\rollback-bluegreen.ps1 -StopRolledBackProject
```

## Media Worker And DLQ

Use this flow for `MemeseeMediaWorkerNotReady` and `MemeseeMediaWorkerFailures`.

Inspect DLQ depth:

```powershell
.\scripts\rabbitmq-dlq.ps1 -Action Inspect
```

Peek at messages without removing them:

```powershell
.\scripts\rabbitmq-dlq.ps1 -Action Peek -Count 10
```

Requeue only after confirming the failure cause is fixed:

```powershell
.\scripts\rabbitmq-dlq.ps1 -Action Requeue -Count 25 -Plan
.\scripts\rabbitmq-dlq.ps1 -Action Requeue -Count 25 -ConfirmDestructive -AuditFile incident-dlq-audit.json
```

Purge only when messages are known bad or unrecoverable:

```powershell
.\scripts\rabbitmq-dlq.ps1 -Action Purge -Plan
.\scripts\rabbitmq-dlq.ps1 -Action Purge -ConfirmDestructive -AuditFile incident-dlq-audit.json
```

After DLQ action, verify media worker metrics and runtime:

```powershell
.\scripts\verify-production-runtime.ps1 -GatewayUrl http://127.0.0.1:8080 -FrontendUrl http://127.0.0.1:3000 -PrometheusUrl http://127.0.0.1:9090 -VerifyMediaWorkerMetrics
```

## Alert Response Matrix

| Alert | First check | Recovery action |
| --- | --- | --- |
| `MemeseeTargetDown` | Confirm the affected service health and Prometheus target. | Restart the service or roll back if the target went down immediately after deploy. |
| `MemeseeApiP95High` | Run `.\scripts\measure-api-latency.ps1 -GatewayUrl http://127.0.0.1:8080 -Iterations 50`. | Check DB/cache pressure, recent deploys, and roll back if latency regressed after release. |
| `MemeseeApi5xxRateHigh` | Run `.\scripts\verify-production-launch.ps1 -FromEnvFile .env`. | Inspect gateway/content/user logs, then roll back if the error is release-related. |
| `MemeseeCacheHitRateLow` | Check `DEPLOY_VERIFY_CACHE_METRICS` and Prometheus cache samples. | Warm common paths, inspect cache keys, and verify with `-VerifyCacheMetrics`. |
| `MemeseeProjectionQuerySlow` | Check DB indexes with `.\scripts\verify-content-db-indexes.ps1`. | Inspect query shape and recent migrations before raising DB capacity. |
| `MemeseeContentCommandErrorRateHigh` | Check `memesee_content_command_total` by `aggregate`, `operation`, and `outcome` in Prometheus. | Inspect content-service command logs for `event="content_command"`, then roll back if create/update/delete errors started after release. |
| `MemeseeContentCommandP95High` | Check `memesee_content_command_duration_seconds_bucket` by `aggregate` and `operation`. | Compare DB/cache/media side-effect pressure, then reduce traffic or roll back if command latency regressed after deploy. |
| `MemeseeMediaWorkerNotReady` | Run `.\scripts\rabbitmq-dlq.ps1 -Action Inspect`. | Restart media worker after confirming RabbitMQ, DB, and MinIO are reachable. |
| `MemeseeMediaWorkerFailures` | Peek DLQ with `.\scripts\rabbitmq-dlq.ps1 -Action Peek -Count 10`. | Fix the cause, then requeue with `-ConfirmDestructive`; purge only known bad messages. |
| `MemeseeShareHtmlRenderErrors` | Run `.\scripts\verify-production-launch.ps1 -FromEnvFile .env -PrintCommand`, then execute it. | Check content-service share HTML logs and outer nginx crawler routing. |
| `MemeseeShareHtmlDefaultImageFallbackHigh` | Verify media URLs and OG image selection for recent posts. | Repair media variants or fallback image configuration. |
| `MemeseeShareHtmlSubPostFallbackHigh` | Verify `/share/posts/<id>?subPost=<subId>` for real posts. | Check stale links, deleted sub-posts, and cross-post subPost IDs. |

## Share Preview Incidents

Use this flow when social cards are missing, stale, or showing the wrong image.

```powershell
.\scripts\verify-production-launch.ps1 -FromEnvFile .env -PrintCommand
.\scripts\verify-production-launch.ps1 -FromEnvFile .env
```

If direct share HTML works but `/posts/<id>` fails for crawler user agents, inspect the outer Nginx config:

```powershell
.\scripts\verify-nginx-config.ps1
pwsh -NoProfile -File scripts\verify-nginx-frontend-proxy-runtime.ps1 -NginxConfigVariant ssl
```

If share HTML returns default images too often, check whether the affected posts have usable media variants and whether `CONTENT_MEDIA_PUBLIC_BASE_URL` points at the public media origin.

## Post-Incident Closure

Before closing an incident:

1. Run the launch verifier against the active environment.
2. Run or attach the post-launch monitoring output when the incident followed a deploy.
3. Confirm Prometheus targets are up and relevant alert metrics have returned below threshold.
4. Attach `incident-preflight.json`, `post-launch-monitoring.json`, `incident-rollback-audit.json`, or `incident-dlq-audit.json` when preflight, rollback, DLQ requeue, purge, nginx reload, or env changes were used.
5. Update this runbook if any command or decision point was missing.
