# Authentication Configuration

## Configuration flow

Deployment values are read and normalized in `config/`; authentication and
infrastructure modules do not scatter direct `process.env` access:

```text
.env / deployment secrets
        ↓
      config/
        ↓
    lib / services
```

`config/` does not implement authentication, create database connections,
send email, or implement business services. Do not import server configuration
from Client Components. No provider-specific secret is stored in this
repository.

## Current environment variables

| 变量 | 配置模块 | 用途 | 当前要求 |
| --- | --- | --- | --- |
| `DATABASE_URL` | `config/database.ts` | `pg.Pool` 与 Better Auth 的 PostgreSQL 连接地址 | 当前必须；服务端变量，不提交真实地址或密码 |
| `BETTER_AUTH_SECRET` | `config/auth.ts` | Better Auth 服务端加密、签名与认证安全所需 secret | 当前必须；高熵值，正式环境单独配置 |
| `BETTER_AUTH_URL` | `config/auth.ts` | Better Auth 应用基础地址 | 当前必须；生产使用实际 HTTPS 地址 |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `config/auth.ts` | 可选的逗号分隔 trusted origins | 正式跨域部署前配置；空值不产生 `['']` |
| `BUSINESS_BACKEND_URL` | `config/backend.ts` | 未来业务后端的服务端地址 | 未来业务后端实现时再填写 |

`BETTER_AUTH_TRUSTED_ORIGINS` 会被裁剪并过滤空项，例如：

```text
https://example.com, https://admin.example.com
```

会规范化为两个 origin。未配置时不显式传入 Better Auth，以保持当前默认
行为。`NEXT_PUBLIC_API_URL` 没有运行时代码引用，已从当前配置模板收敛掉；
浏览器不应默认直接知道未来 Python/Go/Java 服务地址。

## Email Provider configuration boundary

真实 Provider 尚未确定。`config/email.ts` 只预留供应商无关的元数据入口：

- `AUTH_EMAIL_PROVIDER`：Provider type 或 implementation 标识。
- `AUTH_EMAIL_SENDER`：sender/from address。
- `AUTH_EMAIL_SENDER_NAME`：sender name。
- `AUTH_EMAIL_REPLY_TO`：可选 reply-to。

这些字段当前不会实例化 Provider，也不会启用 Email Verification、Password
Reset 或 Email OTP。Provider 确定后，供应商特定 credential、endpoint/region
等才可以由负责人补入同一个配置区域；变量命名必须随正式 Provider 决策确认，
不能预先绑定 Resend、SMTP、SES、SendGrid、阿里云或腾讯云。

## Current Better Auth configuration

`lib/auth/server.ts` 当前只配置：

- `database`：来自 `lib/infrastructure/postgres.ts` 的 `pg.Pool`。
- 条件化的 `secret`、`baseURL` 和可选 `trustedOrigins`。
- `emailAndPassword.enabled`：`true`。
- `emailAndPassword.minPasswordLength`：`12`。
- `emailAndPassword.maxPasswordLength`：`64`。
- password hash/verify、Session、Cookie：Better Auth 默认实现。
- sign-up password composition：由纯 policy 和 Better Auth 官方
  `hooks.before` 在 `/sign-up/email` 入口执行。
- plugins：无新增插件。

本阶段不增加 Email Provider、Email Verification、Email OTP、Password Reset、
CAPTCHA、OAuth、2FA、Passkey、RBAC、Redis 或业务身份协议配置。

## 官方 Migration

- 文件：`db/migrations/001_better_auth.sql`
- 数据库：PostgreSQL
- 来源：Better Auth `1.6.28` 官方 CLI Migration
- 核心表：`user`、`account`、`session`、`verification`
- 本阶段没有修改 Schema，也没有手写新的 auth migration。

## 后续配置类别

下一阶段在启用对应能力前，需要负责人确定：

- 正式 Web URL/domain 与 `BETTER_AUTH_TRUSTED_ORIGINS`。
- Email Provider、sender/from、reply-to、credential 和 provider endpoint/region。
- shared rate-limit storage（如果部署为多实例）。
- CAPTCHA/Turnstile。
- 未来业务后端服务地址 `BUSINESS_BACKEND_URL`。

未来可选能力包括 OAuth、2FA 和 Passkey。Reset Password、Change Password、Set
Password 启用时，所有创建新密码的入口还必须复用同一个 password policy。
