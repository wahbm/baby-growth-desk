# 糖糖成长工作台

记录糖糖的学习安排、完成进度和健康就诊信息。业务数据通过同源 REST API 持久化到 MariaDB，浏览器存储不再作为数据源。

## 技术与数据架构

- 前端与 API：React 19、Vinext、Next App Router route handlers
- 生产运行时：Node.js 22 standalone，由 systemd 管理并只监听 `127.0.0.1:3101`
- 数据库：ECS 上的共享原生 MariaDB；本项目使用独立数据库 `baby_growth_desk` 和独立本机账号
- 数据表：`study_records`、`health_records`，字符集为 `utf8mb4`
- 鉴权：服务端 `APP_ACCESS_TOKEN` 换取 90 天 HttpOnly、SameSite=Strict 会话 cookie
- 连接池：默认最多 4 个连接，适配低内存共享 ECS

选择 MariaDB 是为了遵循 `wahbm` 的低资源 ECS 部署契约：复用一个原生数据库进程，不新增 Docker、Redis、SQLite 文件或第二套数据库服务；3306 不对公网开放。

本仓库仍保留 `.openai/hosting.json` 供既有 Vinext 工具链使用，但当前数据库驱动需要原生 TCP，不能部署到不支持 TCP socket 的 Sites Worker 运行时。生产目标是下文的阿里云 ECS standalone 服务。

## 本地运行

前置条件：Node.js `>=22.13.0` 和可访问的 MariaDB。

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

在 `.env.local` 中配置：

- `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`
- `DB_POOL_LIMIT`（低资源环境建议保持 `4`）
- `APP_ACCESS_TOKEN`（独立于数据库密码，至少 16 个字符）
- `NEXT_PUBLIC_BASE_PATH`（根路径本地开发时留空）

应用首次访问数据库时会幂等创建数据表。生产环境也可先执行 `deploy/mariadb/schema.sql`。真实密码和访问口令只能保存在被忽略的本地环境文件或服务器 `/etc/baby-growth-desk.env` 中，不能提交到 Git。

## API

除健康检查和登录外，接口都要求有效的 HttpOnly 会话；写接口还检查同源 `Origin`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 检查服务和 MariaDB，并确保表结构存在 |
| `POST` / `DELETE` | `/api/session` | 登录 / 退出家庭工作台 |
| `GET` | `/api/records` | 读取全部学习与健康记录 |
| `POST` | `/api/records` | 按 ID 合并记录，用于旧版浏览器数据迁移 |
| `PUT` | `/api/records` | 事务性替换全部记录，用于导入备份 |
| `DELETE` | `/api/records` | 事务性清空全部记录 |
| `POST` | `/api/study-records` | 新增学习记录 |
| `PUT` / `DELETE` | `/api/study-records/:id` | 修改 / 删除学习记录 |
| `POST` | `/api/health-records` | 新增健康记录 |
| `PUT` / `DELETE` | `/api/health-records/:id` | 修改 / 删除健康记录 |

接口使用参数化 SQL、长度/日期/枚举校验和数据库事务。错误响应不会包含数据库凭据。

## 旧版数据迁移

升级后，浏览器若仍有 `tangtang-local-desk-v1`：

1. 用户输入家庭访问口令；
2. 应用读取旧 JSON 并通过 `POST /api/records` 按记录 ID 合并到 MariaDB；
3. 只有数据库写入成功后才删除旧 `localStorage` 键。

之后所有增删改查都走 API。导出/导入 JSON 仍保留为人工备份功能。

## 验证命令

```bash
npx tsc --noEmit
npm run build
npm test
```

`npm test` 会验证服务端渲染、数据库 API 接线、旧数据只做一次性迁移、Service Worker 不缓存 API，以及无凭据时健康接口会失败关闭。

## 阿里云 ECS 部署

生产沿用既有不可变 release、`current` 原子软链和 known-good 自动回滚：

- 公共路径：`/liangliang-developer/baby-growth-desk/`
- 本地服务：`127.0.0.1:3101`
- 发布目录：`/var/www/liangliang-developer/baby-growth-desk`
- systemd：`baby-growth-desk.service`
- 工作流：`.github/workflows/deploy-ecs.yml`

服务器配置模板位于 `deploy/`。数据库只监听本机，不开放 3306；服务器环境文件应为 `root:root`、`0600`。上线前需决定 MariaDB 备份策略，当前仓库不会擅自创建定时备份。
