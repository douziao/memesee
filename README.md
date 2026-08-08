# MemeSee / 眯眼看世界

MemeSee 是一个前后端分离的内容社区平台，覆盖用户认证、社区目录、主帖/回复、点赞收藏、通知、媒体上传、首页信息流和搜索索引等能力。项目当前重点不是做一个静态 Demo，而是把一个完整社区产品拆成可运行、可观测、可部署的工程系统。

当前主链路：

```text
Browser
  -> frontend                React + Vite SPA
  -> gateway-service         Spring Cloud Gateway, /api/* unified entry
  -> user-service            auth, JWT, user progress
  -> content-service         community, posts, feed, media, search, notifications
  -> mysql                   memesee_user / memesee_content schemas
```

附加基础设施：

- Redis：读侧缓存、分布式锁、Outbox/缓存协调。
- RabbitMQ：图片变体异步处理队列和 DLQ。
- MinIO：帖子图片对象存储。
- Meilisearch：主帖搜索索引。
- media-worker：基于 Sharp 生成 WebP 多尺寸图片和 blur placeholder。
- Prometheus / Loki / Tempo / Grafana：指标、日志、trace 和运行态仪表盘。

## 项目结构

```text
memesee/
  backend/
    platform-common/     公共错误模型、JWT、缓存、日志和请求关联工具
    user-service/        注册登录、JWT、用户成长/活跃度
    content-service/     社区、主帖、回复、互动、通知、媒体、信息流、搜索
    gateway-service/     Spring Cloud Gateway，统一转发 /api/**
  frontend/              React + Vite 单页应用
  media-worker/          RabbitMQ 图片处理 worker
  db/init/               MySQL 初始化脚本
  deploy/                生产 compose、Nginx、Prometheus 和部署脚本
  scripts/               本地/生产验证、发布、回滚、审计脚本
  docker-compose.yml     本地基础设施
  docker-compose.prod.yml 生产部署编排
```

## 技术栈

- Frontend: React 18, Vite 8, Axios, Vitest
- Backend: Java 21, Spring Boot 3.3.5, Spring Cloud Gateway 2023.0.3
- Data: MySQL 8.4, Flyway, Spring Data JPA, MyBatis
- Cache & Async: Redis 7.4, RabbitMQ 4.1, Redisson, transactional outbox
- Search & Media: Meilisearch, MinIO, Node.js media-worker, Sharp, WebP variants
- Observability: Actuator, Micrometer, Prometheus, Loki, Tempo, Grafana, OTLP
- Deploy: Docker Compose, Nginx, PowerShell/Bash verification scripts

## 核心能力

- 用户：邀请码注册、登录、JWT、当前用户、用户成长/活跃度。
- 社区：启动时初始化默认社区目录，支持社区详情和社区过滤。
- 内容：主帖、回复、浏览、热度、最近活动排序、Markdown/媒体展示。
- 互动：主帖/回复点赞、收藏、个人互动列表。
- 通知：互动和回复通知、已读状态、未读数量缓存。
- Feed：`/api/feed` 基于投影表读取，支持社区、关键词和排序。
- 搜索：内容变更通过 Outbox 同步到 Meilisearch，查询失败时保留数据库回退能力。
- 媒体：图片上传到 MinIO，生成 `THUMB / SMALL / MEDIUM / DISPLAY` WebP 变体，失败进入 DLQ，可重试。
- 观测：请求关联、Prometheus 指标、结构化日志、trace、缓存/Outbox/媒体/分享 HTML dashboard。

## 快速开始

### 1. 准备环境

需要本机已有：

- Docker Desktop / Docker Compose
- JDK 21
- Maven 3.9+
- Node.js 20.19+ 或 22.12+
- npm

本仓库没有提交 Maven Wrapper，所以需要本机可用的 `mvn` 命令。

### 2. 启动基础设施

在仓库根目录执行：

```powershell
Copy-Item .env.example .env
# 编辑 .env，把 replace-with-* 替换成强随机值，并保持数据库/Redis/RabbitMQ/MinIO/Meili 密码一致
docker compose up -d
```

默认本地端口：

| 服务 | 地址 |
| --- | --- |
| MySQL | `127.0.0.1:3307` |
| Redis | `127.0.0.1:6379` |
| RabbitMQ | `127.0.0.1:5672`, management `127.0.0.1:15672` |
| MinIO | API `127.0.0.1:9000`, console `127.0.0.1:9001` |
| Meilisearch | `127.0.0.1:7700` |

### 3. 启动后端

先构建公共模块：

```powershell
cd backend
mvn -DskipTests install
```

分别在三个终端中启动：

```powershell
cd backend/user-service
mvn spring-boot:run
```

```powershell
cd backend/content-service
mvn spring-boot:run
```

```powershell
cd backend/gateway-service
mvn spring-boot:run
```

默认地址：

| 服务 | 地址 |
| --- | --- |
| gateway-service | `http://localhost:8080` |
| user-service | `http://localhost:8081` |
| content-service | `http://localhost:8083` |

### 4. 启动 media-worker

如果 `.env` 中启用了 `CONTENT_MEDIA_PROCESSING_ASYNC_ENABLED=true`，请单独启动图片处理 worker：

```powershell
cd media-worker
npm install
npm start
```

worker 会消费 RabbitMQ 队列，从 MinIO 读取原图，生成 WebP 变体，更新 MySQL 媒体表，并清理相关 Redis 缓存。

### 5. 启动前端

```powershell
cd frontend
npm install
npm run dev
```

访问：

```text
http://localhost:5173
```

默认前端通过 Vite 代理访问网关：`/api/** -> http://127.0.0.1:8080`。需要局域网访问时使用：

```powershell
npm run dev:lan
```

## 本地注册邀请码

注册接口要求邀请码。开发环境可手动插入一条：

```sql
INSERT INTO invite_codes
  (code, max_uses, used_count, disabled, expires_at, created_at, used_at, used_by)
VALUES
  ('MEMESEE', 100, 0, false, NULL, UTC_TIMESTAMP(6), NULL, NULL);
```

前端注册时使用 `MEMESEE`。

## 常用接口

所有公开接口建议经由网关 `http://localhost:8080` 调用。

| 模块 | 路径 |
| --- | --- |
| 用户 | `POST /api/users/register`, `POST /api/users/login`, `GET /api/users/me` |
| 社区 | `GET /api/communities`, `GET /api/communities/{communitySlug}` |
| Feed | `GET /api/feed` |
| 主帖 | `GET/POST /api/main-posts`, `GET/PUT/DELETE /api/main-posts/{mainPostId}` |
| 回复 | `GET/POST /api/main-posts/{mainPostId}/sub-posts`, `PUT/DELETE /api/sub-posts/{subPostId}` |
| 互动 | `/api/main-posts/{id}/likes`, `/api/main-posts/{id}/favorites`, `/api/sub-posts/{id}/likes`, `/api/sub-posts/{id}/favorites` |
| 媒体 | `POST /api/media-assets`, `GET /api/media-assets/{assetId}`, `GET /api/media-assets/{assetId}/binary` |
| 通知 | `GET /api/notifications`, `PATCH /api/notifications/read-state` |

内部维护接口需要请求头 `X-Internal-Service-Token`：

```powershell
$internalToken = $env:APP_SECURITY_INTERNAL_SERVICE_TOKEN

curl -X POST "http://localhost:8083/internal/feed/main-posts/rebuild" `
  -H "X-Internal-Service-Token: $internalToken"

curl -X POST "http://localhost:8083/internal/search/main-posts/rebuild" `
  -H "X-Internal-Service-Token: $internalToken"

curl -X POST "http://localhost:8083/internal/media-assets/variants/retry-failed?limit=20" `
  -H "X-Internal-Service-Token: $internalToken"
```

## 质量门禁

后端：

```powershell
cd backend
mvn test
```

前端：

```powershell
cd frontend
npm run quality
```

media-worker：

```powershell
cd media-worker
npm run check
npm test
npm audit --omit=dev
```

聚合发布就绪检查：

```powershell
.\scripts\verify-release-readiness.ps1
```

较快的静态检查：

```powershell
.\scripts\verify-release-readiness.ps1 -SkipDockerRuntime -SkipBackendTests -SkipMediaWorkerQuality -SkipFrontendQuality
```

### 前端性能预算

生产构建将 initial JS gzip 限制为 122 KiB，initial CSS gzip 限制为 16 KiB，并校验
`AuthModal`、`FloatingActions`、`sharePostLink`、`clipboard`、`ComposerPage`、
`ProfileCenter`、`PostDetailView`、`MarkdownRenderer`、`ImageLightbox` 和 `RichGallery`
保持为受预算约束的懒加载 chunk。

内部维护操作通过 `memesee_internal_admin_operation_total` 记录。发布检查使用
`VerifyInternalAdminMetricDefinitions` 验证指标定义；生产环境可通过
`DEPLOY_VERIFY_INTERNAL_ADMIN_METRICS` 控制是否要求运行态指标样本。

## 观测与运行验证

后端三个服务暴露 Actuator `health/info/metrics/prometheus`；media-worker 暴露 `/healthz` 和 `/metrics`。

常用验证：

```powershell
.\scripts\verify-observability.ps1
.\scripts\verify-prometheus-config.ps1
.\scripts\measure-api-latency.ps1 -GatewayUrl http://127.0.0.1:8080 -Iterations 30
```

生产运行验证示例：

```powershell
.\scripts\verify-production-runtime.ps1 `
  -GatewayUrl http://127.0.0.1:8080 `
  -FrontendUrl http://127.0.0.1:3000 `
  -PrometheusUrl http://127.0.0.1:9090 `
  -PrimeMetrics `
  -VerifyApiMetrics `
  -VerifyProjectionQueryMetrics `
  -VerifyMediaWorkerMetrics
```

生产事故处理参考 [docs/production-incident-runbook.md](docs/production-incident-runbook.md)。

## 关键配置

本地默认值可运行；生产环境请使用 `SPRING_PROFILES_ACTIVE=prod`，并确保没有占位符密钥。

| 变量 | 说明 |
| --- | --- |
| `APP_SECURITY_JWT_SECRET` | 用户服务与内容服务共享的 JWT 密钥 |
| `APP_SECURITY_INTERNAL_SERVICE_TOKEN` | 内部维护接口凭证，生产必须使用长随机值 |
| `USER_DB_URL`, `CONTENT_DB_URL` | 用户库和内容库连接 |
| `MEMESEE_REDIS_*` | Redis 连接与密码 |
| `MEMESEE_RABBITMQ_*` | RabbitMQ 连接与密码 |
| `CONTENT_OUTBOX_PROCESSOR_ENABLED` | 内容服务 Outbox 处理开关 |
| `CONTENT_SEARCH_MEILISEARCH_*` | Meilisearch 地址、API key 和索引名 |
| `CONTENT_MEDIA_PROCESSING_ASYNC_ENABLED` | 是否通过 RabbitMQ 异步生成媒体变体 |
| `CONTENT_MEDIA_MINIO_*` | MinIO 地址、凭证和 bucket |
| `CONTENT_MEDIA_DIRECT_DELIVERY_ENABLED` | 是否返回对象存储/CDN 直出 URL |
| `CONTENT_MEDIA_PUBLIC_BASE_URL` | 图片公开访问前缀 |
| `USER_SERVICE_URL`, `CONTENT_SERVICE_URL` | 服务间调用和网关下游地址 |
| `FRONTEND_ORIGIN` | 网关 CORS 来源 |
| `MANAGEMENT_TRACING_*`, `MANAGEMENT_OTLP_TRACING_ENDPOINT` | tracing 开关、采样率和 OTLP endpoint |

## 生产部署

生产部署有两种方式：Ubuntu ARM64/AMD64 + 1Panel 推荐直接使用已经发布的多架构镜像；需要服务器本地构建或自动安装 Nginx 时，再使用 `docker-compose.prod.yml` 和 `deploy/deploy.sh`。

### 1Panel 部署（推荐）

不需要在服务器上 `git clone`，也不需要手动创建每个容器。1Panel 的编排会按 Compose 文件自动创建基础设施和业务容器，业务镜像从 GHCR 拉取。

1. 在 GitHub Actions 的 `Publish Images` 成功后，确认使用一个已发布版本（当前为 `v0.1.1`）。该版本同时提供 `linux/amd64` 和 `linux/arm64` manifest。
2. 在 1Panel 新建编排，上传仓库中的 `docker-compose.1panel.yml`、`db/init/01-init.sh`、`deploy/otel-collector.yml`、`deploy/prometheus/` 目录。Compose 文件所在目录应作为编排工作目录，保证相对路径挂载有效。
3. 复制 `.env.example`（或 `deploy/.env.production.example`）为该编排的 `.env`，至少修改所有 `replace-with-*` 密钥、`FRONTEND_ORIGIN`、`CONTENT_MEDIA_PUBLIC_BASE_URL`，并确认：

```dotenv
MEMESEE_IMAGE_REGISTRY=ghcr.io/douziao
MEMESEE_VERSION=v0.1.1
```

4. 在 1Panel 中点击“拉取镜像”后“启动/重建”。如果 GHCR 仓库为私有，先在服务器执行 `docker login ghcr.io`，使用具有 `read:packages` 权限的 GitHub PAT；公开镜像无需登录。
5. 只将 1Panel/OpenResty 对外暴露 80/443，并反向代理到 `127.0.0.1:${FRONTEND_HOST_PORT}`；网关 API 通过前端 Nginx 的 `/api/` 路径访问。MySQL、Redis、RabbitMQ、MinIO、Meilisearch、Prometheus 端口已绑定到 `127.0.0.1`，不要开放到公网。

更新或回滚时只需修改 `.env` 中的 `MEMESEE_VERSION`，再次“拉取镜像”并重建；不要使用 `latest`。

### 本地构建部署

需要服务器本地构建时才执行以下流程：

```bash
cd /opt
git clone <repo-url> memesee
cd /opt/memesee
cp deploy/.env.production.example .env
# 编辑 .env，替换所有 replace-with-*，设置域名、密钥和端口
bash deploy/deploy.sh
```

生产流量路径：

```text
Browser -> Nginx :443
  /        -> frontend container
  /api/    -> gateway-service
  /media/  -> MinIO bucket or CDN path
  metrics  -> Prometheus on localhost
```

部署脚本会构建/启动容器，安装 Nginx 站点配置，并执行运行时验证。上线前建议执行：

```powershell
.\scripts\verify-production-env.ps1 -EnvFile .env
.\scripts\verify-production-preflight.ps1 -EnvFile .env -ReleaseId memesee-YYYY-MM-DD
```

### GitHub Actions 与镜像发布

合并到 `main` 前先等待 `Quality Gate` 通过，再创建 `v*` Git Tag。`Publish Images`
会复用质量门禁，并把五个业务镜像发布到 `ghcr.io/douziao`。1Panel 使用
`docker-compose.1panel.yml`，在服务器 `.env` 中设置同一个版本：

```dotenv
MEMESEE_IMAGE_REGISTRY=ghcr.io/douziao
MEMESEE_VERSION=v0.1.1
```

服务器部署目录仍需保留 `db/init/`、`deploy/otel-collector.yml` 和
`deploy/prometheus/`，因为基础设施容器会只读挂载这些配置。发布工作流同时生成
`linux/amd64` 和 `linux/arm64` 镜像，ARM64 服务器必须使用包含多架构 manifest 的版本标签。

蓝绿部署、回滚、发布证据包和 post-launch 观察窗口相关脚本位于 `scripts/`，架构说明见：

发布预检建议把审计和验证结果写入 `deploy/release-artifacts/<release-id>/`。这些文件可能
包含生产运行证据，`do not commit these artifacts`；该目录已由 `.gitignore` 排除。

- [docs/architecture-phase-1.md](docs/architecture-phase-1.md)
- [docs/architecture-phase-2.md](docs/architecture-phase-2.md)
- [docs/production-incident-runbook.md](docs/production-incident-runbook.md)

## 数据与迁移注意

- 用户库和内容库分别由各自服务的 Flyway 管理。
- `content-service` 的媒体变体迁移会影响旧测试内容；生产执行前必须确认迁移含义。
- MinIO bucket 默认为 `memesee-post-images`，可由内容服务或生产 `minio-init` 自动创建。
- 修改 RabbitMQ 队列/DLX 参数后，如果环境里已有旧同名队列，需要删除旧队列再让服务重建。
- 线上只开放前端、网关和可选 `/media/`，不要把 MySQL、Redis、RabbitMQ、MinIO Console、Meilisearch、Prometheus 直接暴露到公网。

## 清空本地测试数据

本地旧图片或旧帖子影响排查时可重置 Docker 数据卷：

```powershell
.\scripts\reset-local-data.ps1 -ConfirmReset
```

线上服务器不要使用该脚本。

## 常用命令

```powershell
# 查看基础设施状态
docker compose ps

# 停止基础设施
docker compose down

# 停止并清空本地数据卷
docker compose down -v

# 后端构建
cd backend
mvn -DskipTests install

# 前端生产构建
cd frontend
npm run build
```
