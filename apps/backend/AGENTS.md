# ShenZhi Backend · Agent 开发规范

FastAPI 业务后端：`apps/backend/app/`。

## 边界

- 浏览器只访问 Next.js；本服务由 `/api/v1` 转发接入
- 读取 `X-Shenzhi-User-Id` / `X-Shenzhi-User-Email`，**不**读 Better Auth 表
- 会话/Chat 持久化使用独立 PostgreSQL（目标态）；不与 Auth Schema 混用

## 本地环境（uv）

```bash
cd apps/backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

依赖与锁文件：`pyproject.toml`、`uv.lock`。

## 路由约定

- 健康检查：`GET /health`
- 业务 API：`/api/v1/*`（与前端 A 协议对齐）
- 论文检索：`POST /api/v1/search/explore` → 外部 `RETRIEVAL_API_URL`

## 环境变量

见 `.env.example`：`RETRIEVAL_API_URL`、`RETRIEVAL_TIMEOUT_SEC`，以及后续 LLM/DB 相关变量。
