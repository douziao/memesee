#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/memesee}"
DOMAIN="${DOMAIN:-memesee.world}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
NGINX_SITE_NAME="${NGINX_SITE_NAME:-memesee.world.conf}"
SKIP_PULL="${SKIP_PULL:-false}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-30}"
HEALTHCHECK_INTERVAL_SECONDS="${HEALTHCHECK_INTERVAL_SECONDS:-2}"
DEPLOY_VERIFY_PRODUCTION_RUNTIME="${DEPLOY_VERIFY_PRODUCTION_RUNTIME:-true}"
DEPLOY_AUDIT_FILE="${DEPLOY_AUDIT_FILE:-}"
DEPLOY_LAUNCH_AUDIT_FILE="${DEPLOY_LAUNCH_AUDIT_FILE:-}"
DEPLOY_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DEPLOY_GIT_BEFORE=""
DEPLOY_GIT_AFTER=""
GATEWAY_PORT=""
FRONTEND_PORT=""
PROMETHEUS_PORT=""
NGINX_SOURCE=""

write_deploy_audit() {
  local status="$1"
  local exit_code="$2"
  local detail="$3"

  if [ -z "$DEPLOY_AUDIT_FILE" ]; then
    return 0
  fi

  if ! command -v pwsh >/dev/null 2>&1; then
    echo "pwsh is required to write DEPLOY_AUDIT_FILE=$DEPLOY_AUDIT_FILE; skipped deploy audit." >&2
    return 0
  fi

  pwsh -NoProfile -File scripts/write-deploy-audit.ps1 \
    -OutputFile "$DEPLOY_AUDIT_FILE" \
    -Status "$status" \
    -StartedAt "$DEPLOY_STARTED_AT" \
    -ExitCode "$exit_code" \
    -Detail "$detail" \
    -AppDir "$APP_DIR" \
    -Domain "$DOMAIN" \
    -ComposeFile "$COMPOSE_FILE" \
    -NginxSiteName "$NGINX_SITE_NAME" \
    -NginxSource "$NGINX_SOURCE" \
    -SkipPull "$SKIP_PULL" \
    -RuntimeVerification "$DEPLOY_VERIFY_PRODUCTION_RUNTIME" \
    -GatewayPort "$GATEWAY_PORT" \
    -FrontendPort "$FRONTEND_PORT" \
    -PrometheusPort "$PROMETHEUS_PORT" \
    -GitBefore "$DEPLOY_GIT_BEFORE" \
    -GitAfter "$DEPLOY_GIT_AFTER" \
    -LaunchAuditFile "$DEPLOY_LAUNCH_AUDIT_FILE" >/dev/null || true
}

handle_deploy_exit() {
  local exit_code="$1"
  if [ "$exit_code" -eq 0 ]; then
    write_deploy_audit "OK" "$exit_code" "deployment finished"
  else
    write_deploy_audit "FAILED" "$exit_code" "deployment failed"
  fi
}

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempt=1

  until curl -fsS "$url" >/dev/null; do
    if [ "$attempt" -ge "$HEALTHCHECK_RETRIES" ]; then
      echo "$name is not responding after $HEALTHCHECK_RETRIES attempts: $url" >&2
      return 1
    fi
    echo "Waiting for $name ($attempt/$HEALTHCHECK_RETRIES): $url"
    attempt=$((attempt + 1))
    sleep "$HEALTHCHECK_INTERVAL_SECONDS"
  done

  echo "$name is ready: $url"
}

wait_for_service_health() {
  local service="$1"
  local attempt=1
  local container_id=""
  local status=""

  until container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service")" && [ -n "$container_id" ]; do
    if [ "$attempt" -ge "$HEALTHCHECK_RETRIES" ]; then
      echo "$service container was not created after $HEALTHCHECK_RETRIES attempts" >&2
      return 1
    fi
    echo "Waiting for $service container ($attempt/$HEALTHCHECK_RETRIES)"
    attempt=$((attempt + 1))
    sleep "$HEALTHCHECK_INTERVAL_SECONDS"
  done

  attempt=1
  until [ "$status" = "healthy" ]; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
    if [ "$status" = "healthy" ]; then
      break
    fi
    if [ "$status" = "none" ]; then
      echo "$service does not define a Docker healthcheck" >&2
      return 1
    fi
    if [ "$attempt" -ge "$HEALTHCHECK_RETRIES" ]; then
      echo "$service is not healthy after $HEALTHCHECK_RETRIES attempts; last status: $status" >&2
      docker compose -f "$COMPOSE_FILE" logs --tail=80 "$service" >&2 || true
      return 1
    fi
    echo "Waiting for $service health ($attempt/$HEALTHCHECK_RETRIES): $status"
    attempt=$((attempt + 1))
    sleep "$HEALTHCHECK_INTERVAL_SECONDS"
  done

  echo "$service is healthy"
}

run_production_runtime_verification() {
  if [ "$DEPLOY_VERIFY_PRODUCTION_RUNTIME" != "true" ]; then
    echo "Skipped production runtime verification because DEPLOY_VERIFY_PRODUCTION_RUNTIME is not true."
    return 0
  fi

  if ! command -v pwsh >/dev/null 2>&1; then
    echo "pwsh is required for scripts/verify-production-launch.ps1. Install PowerShell or set DEPLOY_VERIFY_PRODUCTION_RUNTIME=false." >&2
    return 1
  fi

  local launch_args=(-NoProfile -File scripts/verify-production-launch.ps1 -FromEnvFile .env)
  if [ -n "$DEPLOY_LAUNCH_AUDIT_FILE" ]; then
    launch_args+=(-OutputFile "$DEPLOY_LAUNCH_AUDIT_FILE")
  fi

  pwsh "${launch_args[@]}"
}

env_file_value() {
  local name="$1"
  local fallback="$2"
  local value=""

  value="$(grep -E "^${name}=" .env | tail -n 1 | cut -d= -f2- || true)"
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  if [ -z "$value" ]; then
    echo "$fallback"
  else
    echo "$value"
  fi
}

cd "$APP_DIR"
trap 'handle_deploy_exit $?' EXIT

if [ ! -f ".env" ]; then
  echo "Missing .env. Copy deploy/.env.production.example to .env and fill secrets first." >&2
  exit 1
fi

if grep -Eq 'replace-with-|same-value-as' .env; then
  echo ".env still contains placeholder values. Replace every replace-with-* value before deploying." >&2
  grep -En 'replace-with-|same-value-as' .env >&2 || true
  exit 1
fi

GATEWAY_PORT="$(env_file_value GATEWAY_HOST_PORT 8080)"
FRONTEND_PORT="$(env_file_value FRONTEND_HOST_PORT 3000)"
PROMETHEUS_PORT="$(env_file_value PROMETHEUS_HOST_PORT 9090)"
DEPLOY_VERIFY_PRODUCTION_RUNTIME="$(env_file_value DEPLOY_VERIFY_PRODUCTION_RUNTIME "$DEPLOY_VERIFY_PRODUCTION_RUNTIME")"
DEPLOY_AUDIT_FILE="$(env_file_value DEPLOY_AUDIT_FILE "$DEPLOY_AUDIT_FILE")"
DEPLOY_LAUNCH_AUDIT_FILE="$(env_file_value DEPLOY_LAUNCH_AUDIT_FILE "$DEPLOY_LAUNCH_AUDIT_FILE")"
if [ -n "$DEPLOY_AUDIT_FILE" ] && [ -z "$DEPLOY_LAUNCH_AUDIT_FILE" ]; then
  DEPLOY_LAUNCH_AUDIT_FILE="${DEPLOY_AUDIT_FILE%.json}.launch.json"
fi

if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -File scripts/verify-production-env.ps1 -EnvFile .env
  pwsh -NoProfile -File scripts/verify-production-container-hardening.ps1
else
  echo "pwsh is not installed; skipped production env preflight."
fi

DEPLOY_GIT_BEFORE="$(git rev-parse HEAD 2>/dev/null || true)"
if [ "$SKIP_PULL" != "true" ]; then
  git pull --ff-only
fi
DEPLOY_GIT_AFTER="$(git rev-parse HEAD 2>/dev/null || true)"

docker compose -f "$COMPOSE_FILE" up -d --build

wait_for_service_health user-service
wait_for_service_health content-service
wait_for_service_health gateway-service
wait_for_service_health media-worker
wait_for_service_health frontend
wait_for_service_health prometheus

if command -v nginx >/dev/null 2>&1; then
  if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    NGINX_SOURCE="deploy/nginx/$DOMAIN.ssl.conf"
  else
    NGINX_SOURCE="deploy/nginx/$DOMAIN.http.conf"
  fi

  if [ ! -f "$NGINX_SOURCE" ]; then
    echo "Missing nginx config: $NGINX_SOURCE" >&2
    exit 1
  fi

  if [ -d /etc/nginx/sites-available ]; then
    sudo cp "$NGINX_SOURCE" "/etc/nginx/sites-available/$NGINX_SITE_NAME"
    sudo ln -sfn "/etc/nginx/sites-available/$NGINX_SITE_NAME" "/etc/nginx/sites-enabled/$NGINX_SITE_NAME"
  else
    sudo cp "$NGINX_SOURCE" "/etc/nginx/conf.d/$NGINX_SITE_NAME"
  fi

  sudo nginx -t
  sudo systemctl reload nginx
else
  echo "nginx is not installed; skipped nginx config install."
fi

wait_for_url "http://127.0.0.1:${GATEWAY_PORT}/api/communities" gateway-service
wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" frontend
wait_for_url "http://127.0.0.1:${PROMETHEUS_PORT}/-/ready" prometheus
run_production_runtime_verification

echo "memesee deployment finished for $DOMAIN"
echo "If /api returns 500, inspect logs with:"
echo "  docker compose -f $COMPOSE_FILE logs --tail=200 gateway-service user-service content-service"
