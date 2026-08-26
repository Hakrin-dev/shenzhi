# Business backend boundary

ShenZhi 业务后端已锁定为 **Python + FastAPI**（`apps/backend`）。

```text
Frontend (React)
  ↓ 同源 /api/v1
Next.js BFF  apps/web/app/api/v1/[...path]
  ↓  apps/web/services/backend/forward.ts
BUSINESS_BACKEND_URL
  ↓
FastAPI  apps/backend
```

浏览器不得直连 FastAPI。转发时附带 `X-ShenZhi-User-Id` / `X-ShenZhi-User-Email`，不转发 Better Auth Cookie。

FastAPI 不得读取 Better Auth 的 `user`、`account`、`session`、`verification` 表，也不得依赖 `pg.Pool` 或 `apps/web/lib/auth/server.ts`。
