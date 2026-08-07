# MemeSee 项目分析、学习路线与持续部署指南

> 本文保存当前项目分析、优化建议、学习路线，以及部署后持续同步更新的方法。

## 一、项目分析

MemeSee 是一个面向真实运行环境的内容社区平台，而不是简单 CRUD Demo。主要链路为：

```text
Browser -> React/Vite -> Spring Cloud Gateway
        -> user-service / content-service
        -> MySQL / Redis / RabbitMQ / MinIO / Meilisearch
```

- `frontend`：页面、交互、客户端状态和 API 调用。
- `gateway-service`：统一入口，负责 CORS、超时、重试、熔断和追踪。
- `user-service`：注册、登录、JWT、邀请码和用户成长。
- `content-service`：社区、帖子、回复、Feed、互动、通知、搜索和媒体元数据。
- `media-worker`：消费 RabbitMQ 消息，用 Sharp 生成 WebP 图片变体。
- Prometheus、Loki、Tempo、Grafana 提供指标、日志和链路追踪。

### 代码组织

后端是 Maven 多模块工程，`content-service` 按业务域组织，并分为 `api`、`application`、`domain`、`dto`、`infrastructure`。这种方式接近 DDD、六边形架构和 Clean Architecture，边界清晰，但简单功能也会涉及较多文件。

前端采用 feature-first，按 `auth`、`feed`、`posts`、`media`、`notifications`、`profile` 等功能组织。项目自行实现较多 runtime、路由和服务端状态逻辑，测试性好，但认知成本偏高。

数据库使用 Flyway 演进，包含 Feed 投影、查询索引、Transactional Outbox、媒体变体和通知去重，是正确的生产实践。

### 核心链路

```text
发布帖子 -> Gateway -> Controller -> Application Service
-> Repository -> MySQL -> Feed 投影 -> Outbox
-> Meilisearch -> Redis 缓存失效
```

```text
上传原图 -> MinIO -> RabbitMQ -> media-worker
-> 生成 WebP -> 更新 MySQL -> 清理 Redis -> 失败进入 DLQ
```

### 做得好的地方

1. 服务边界克制，没有过早拆分 Feed、搜索和通知服务。
2. 有读模型意识，Feed、通知和互动列表使用投影和专门查询。
3. 包含 Outbox、重试、分布式锁、DLQ 和重放工具。
4. Health、Metrics、Request ID、Trace ID 和慢查询指标覆盖全面。
5. 已有 Nginx、健康检查、蓝绿部署、回滚和事故手册。
6. 实际运行前端测试：95 个测试文件、933 个测试全部通过。

## 二、优化优先级

### P0：整理 Git 基线

当前工作区存在大量修改和未跟踪文件。应按后端、前端、媒体、观测、部署和文档拆分，每组单独测试、审查和提交，不要将数百个文件作为一个版本部署。

### P1：主要优化

- 使用 React Router 管理页面边界，TanStack Query 管理服务端状态，渐进降低 `useAppRuntime` 复杂度。
- 使用 Testcontainers 补充 MySQL、Redis、Outbox、RabbitMQ、Meilisearch 和 MinIO 集成测试。
- 使用 Playwright 覆盖登录、发帖、Feed、互动和媒体上传。
- 大文件改为通过 MinIO Presigned URL 直传，增加 MIME、像素、大小和配额限制。
- `prod` 不提供密钥默认值，限制 Actuator，增加登录、上传和搜索限流。

### P2：工程优化

- 明确 `verify-release-readiness.ps1` 为统一质量入口。
- 抽取公共 PowerShell 模块并整理脚本。
- 添加 Maven Wrapper。
- 使用 ArchUnit 约束后端模块依赖。
- 暂不继续拆微服务，先明确模块和数据边界。

## 三、学习路线

1. 阅读 `README.md`、Compose、Maven 和 npm 配置，画出架构图。
2. 先运行 MySQL、三个 Java 服务和前端，完成登录和纯文本发帖。
3. 追踪简单接口：前端 -> Gateway -> Controller -> Service -> Repository -> DB -> DTO。
4. 给帖子增加一个字段，完成 Flyway、后端、前端和测试的完整修改。
5. 学习 React Hooks、Axios、服务端状态、Cursor 分页和 view-model。
6. 学习索引、`EXPLAIN`、JPA、MyBatis、投影表和事务。
7. 学习 Cache Aside、缓存击穿、Single Flight、分布式锁和一致性。
8. 学习 Outbox、At-least-once、幂等、重试和最终一致性。
9. 学习 RabbitMQ、ACK/NACK、DLQ、MinIO 和 Sharp。
10. 最后学习 Gateway、监控、Tracing、Nginx、CI/CD 和蓝绿部署。

```text
运行项目 -> 看懂查询 -> 看懂写入 -> 修改字段 -> 增加功能
-> 修复 Bug -> 写集成测试 -> 分析性能 -> 模拟故障 -> 部署与回滚
```

## 四、部署后如何持续同步

### 1. 不再删除目录上传

旧方式的问题：容易误删 `.env`，上传大量 `node_modules`、`target`、`dist`，无法确定运行版本，也难以回滚。

正确流程：

```text
本地修改 -> Git 提交 -> 自动测试 -> 推送仓库
-> 服务器拉取明确版本 -> 构建或拉取镜像
-> 启动 -> 健康检查 -> 失败回滚
```

Git 管代码，Docker 镜像管运行产物，`.env` 和数据库属于服务器状态，三者必须分开。

### 2. 首次部署只克隆一次

```bash
cd /opt
git clone <仓库地址> memesee
cd /opt/memesee
cp deploy/.env.production.example .env
chmod 600 .env
# 编辑 .env 后执行
bash deploy/deploy.sh
```

现有 `deploy/deploy.sh` 已包含：生产配置检查、`git pull --ff-only`、Compose 重建、健康检查、Nginx 更新和运行验证，所以无需删除服务器项目。

### 3. 日常更新

本地：

```powershell
git status
git add <本次相关文件>
git commit -m "feat: describe the change"
git push origin main
```

部署前运行：

```powershell
cd backend; mvn test
cd ../frontend; npm run quality
cd ../media-worker; npm run check; npm test
```

服务器：

```bash
cd /opt/memesee
git status --short
git fetch origin
git log --oneline HEAD..origin/main
bash deploy/deploy.sh
```

服务器的 `git status --short` 应为空。不要直接在服务器修改受 Git 管理的代码；临时修复必须带回本地测试和提交。

### 4. 用 Tag 发布明确版本

本地：

```powershell
git tag -a v0.1.0 -m "MemeSee v0.1.0"
git push origin v0.1.0
```

服务器：

```bash
cd /opt/memesee
git fetch --tags
git checkout v0.1.0
SKIP_PULL=true bash deploy/deploy.sh
```

Tag 能明确服务器运行的版本。若使用分支部署，至少执行 `git rev-parse HEAD` 记录 Commit。

### 5. Docker 数据安全

Compose 重建容器不会删除 Named Volumes。普通更新不要执行：

```bash
docker compose down -v
```

`-v` 会删除 MySQL、MinIO 等数据卷。

### 6. 数据库更新

每次结构变化新增 Flyway Migration，例如 `V27__add_example_column.sql`。不要修改已经在生产执行的旧 Migration，否则会产生 checksum 错误。

采用 Expand/Contract：

```text
A：新增字段，代码兼容新旧结构
B：回填数据并改读新字段
C：确认稳定后删除旧字段
```

应用回滚不等于数据库回滚，因此迁移必须尽量向后兼容。部署前备份 MySQL 和 MinIO，并定期进行恢复演练。

### 7. 回滚

部署前记录：

```bash
git rev-parse HEAD
```

新版本异常时：

```bash
cd /opt/memesee
git checkout <previous-tag-or-commit>
SKIP_PULL=true bash deploy/deploy.sh
```

项目还已有 `scripts/deploy-bluegreen.ps1` 和 `scripts/rollback-bluegreen.ps1`。蓝绿方式会先启动候选环境，验证后切换 Nginx，并保留旧环境用于快速回滚。Linux 服务器需要 `pwsh`，正式执行前先用 `-Plan` 查看影响。

### 8. 长期推荐：CI/CD + 镜像仓库

```text
推送 Git Tag -> GitHub Actions 测试 -> 构建镜像
-> 推送 GHCR/Docker Hub -> 服务器拉取指定版本
-> Compose 启动 -> 健康检查 -> 失败回滚
```

镜像使用不可变版本号，例如 `ghcr.io/<owner>/memesee-content:v0.1.0`，不要只使用 `latest`。服务器最终只需：

```bash
git pull --ff-only
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

生产密钥放在 Secrets，只部署测试通过的 Tag，开启生产人工批准，保留上一版本镜像，并在部署后观察 5、15、60 分钟。

## 五、推荐的三步演进

1. **立即采用**：本地 Commit/Push，服务器保留仓库和 `.env`，执行 `deploy/deploy.sh`。
2. **版本稳定后**：用 Git Tag 发布，记录上一稳定 Tag，异常时切回旧 Tag。
3. **正式对外后**：GitHub Actions 构建版本镜像，蓝绿部署、健康检查、Nginx 切换和快速回滚。

## 六、关键原则

1. 代码用 Git 同步，不再手工覆盖目录。
2. `.env` 不进入 Git，数据不放在代码目录。
3. 每次部署对应一个 Commit、Tag 或镜像版本。
4. 部署前测试和备份，部署后健康检查。
5. 数据库迁移保持向后兼容。
6. 回滚方案必须在发布前准备。
7. 服务器不直接写代码。
8. 普通更新不使用 `docker compose down -v`。
