# Authentication Architecture

## 唯一认证内核

Better Auth `1.6.28` 是 ShenZhi 唯一的认证内核。产品代码不维护自建
User、Credential、Session、JWT、Cookie、password hash 或 OTP 认证实现。

## 当前请求链路

```text
Frontend auth UI
  ↓
lib/auth/client.ts
  ↓
/api/auth/*
  ↓
app/api/auth/[...all]/route.ts
  ↓
lib/auth/server.ts
  ↓
Better Auth
  ↓
lib/infrastructure/postgres.ts
  ↓
PostgreSQL
```

当前 Mock UI 尚未接入上述 Client。`stores/auth.ts`、LoginModal、Sidebar、
reset-password 和 settings 中的旧认证状态属于待替换的 legacy/mock UI，
不是认证内核。

## 认证模型

- `user.email` 是唯一登录标识。
- `user.name` 是展示名称。
- 没有 username plugin，也没有 username credential。
- 没有手机号、短信或其他登录标识。
- `user`、`account`、`session`、`verification` 表由 Better Auth 官方 schema 管理。

## 模块职责

### Frontend

`components/auth/` 负责认证 UI。真实接线完成后，UI 只能调用
`lib/auth/client.ts` 暴露的 Better Auth Client，不直接访问数据库或服务端
Better Auth instance。

### Auth / Better Auth

- `lib/auth/server.ts`：唯一 Better Auth server instance。
- `lib/auth/client.ts`：浏览器端唯一 Better Auth Client。
- `app/api/auth/[...all]/route.ts`：只负责 Next.js HTTP 到 Better Auth Handler 的挂载。
- `lib/infrastructure/postgres.ts`：只创建和导出当前认证使用的 PostgreSQL Pool。
- `lib/auth/providers/`：未来外部 Provider callback adapter。

### Future Business Backend

```text
Authenticated identity
  ↓
language-neutral HTTP / JSON / signed identity contract
  ↓
services/backend/
  ↓
future business service
```

未来业务后端可以使用 Python、Go、Java、TypeScript 或其他技术栈。
业务后端不能直接读取 Better Auth 的 `user`、`account`、`session`、
`verification` 表，也不能依赖 `pg.Pool` 或 `lib/auth/server.ts`。

最终身份协议由业务后端负责人和认证负责人共同确认；本阶段不实现 JWT、
Header 注入、token exchange、proxy 或 API Gateway。

## Provider 边界

Provider adapter 只负责将 Better Auth callback 转换为第三方服务调用，不能
重新实现 Better Auth 的 verification、OTP、password reset token、Session、
Cookie 或 rate-limit 逻辑。真实 Provider 尚未确定。
