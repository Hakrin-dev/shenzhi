# ShenZhi 认证

`docs/auth/` 是 ShenZhi 认证实现的正式文档目录。

## 当前决策

- Better Auth `1.6.28` 是唯一认证内核。
- 数据库使用 PostgreSQL，通过 `pg.Pool` 和 `DATABASE_URL` 接入。
- 当前登录标识只有 email。
- `user.name` 只表示展示名称，不是 username credential。
- 不支持 username login。
- 不支持 phone/SMS。
- 不自建 User、Credential、Session、Cookie、password hash、verification 或 OTP 认证实现。

## Stage 1 已完成

- Better Auth server instance。
- Better Auth React client。
- Next.js App Router Handler。
- Email/Password，密码长度 12–64。
- Better Auth 默认 password hash/verify、Session 和 Cookie。
- PostgreSQL 与官方 CLI Migration。
- sign-up、sign-in、get-session、sign-out、wrong-password 的 Runtime Acceptance。

## Stage 2 已完成

- `lib/auth/server.ts` 与 `lib/auth/client.ts` 认证目录边界。
- `lib/infrastructure/postgres.ts` PostgreSQL 基础设施边界。
- `services/backend/` 未来业务后端责任边界。
- `lib/auth/providers/` 外部 Provider adapter 边界。
- 正式认证文档进入 `docs/auth/`。

## 尚未完成

- LoginModal、Sidebar、reset-password 的真实 Session 接线。
- Email Provider、Email Verification、Email OTP、Password Reset。
- password composition policy。
- trusted origins、shared rate-limit storage、CAPTCHA。
- 未来业务后端身份协议。

详细内容见：

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CONFIGURATION.md](./CONFIGURATION.md)
- [WORKLOG.md](./WORKLOG.md)
