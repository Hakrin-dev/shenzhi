# Authentication Configuration

## 当前环境变量

| 变量 | 用途 | 当前要求 |
| --- | --- | --- |
| `DATABASE_URL` | `pg.Pool` 与 Better Auth 的 PostgreSQL 连接地址 | 服务端变量，不提交真实地址或密码 |
| `BETTER_AUTH_SECRET` | Better Auth 服务端加密、签名与 hash 所需 secret | 服务端变量；使用高熵值，正式环境单独配置 |
| `BETTER_AUTH_URL` | Better Auth 应用基础地址 | 本地可为 `http://localhost:3000`，生产使用实际 HTTPS 地址 |
| `NEXT_PUBLIC_API_URL` | 未来业务后端的公开访问地址占位 | 当前认证流程不使用 |

真实 secret、生产数据库地址和第三方凭据不写入仓库。环境变量示例见
项目根目录的 `.env.example`。

## 当前 Better Auth 配置

`lib/auth/server.ts` 当前只配置：

- `database`：来自 `lib/infrastructure/postgres.ts` 的 `pg.Pool`。
- `emailAndPassword.enabled`：`true`。
- `emailAndPassword.minPasswordLength`：`12`。
- `emailAndPassword.maxPasswordLength`：`64`。
- password hash/verify：Better Auth 默认实现。
- sign-up password composition：由 `lib/auth/policies/password.ts` 和 Better Auth
  官方 `hooks.before` 在 `/sign-up/email` 入口执行；不替换 Better Auth hash/storage。
- plugins：无。

当前不增加 trusted origins、Email Provider、Email Verification、Email OTP、Password
Reset、CAPTCHA 或其他认证功能配置。验证码登录只保留 disabled UI，以保持邮件服务
尚未配置时的认证行为边界。

## Stage 3A 邮件 Provider

代码层只定义 provider-neutral 契约：

- Provider type 或 implementation。
- credential。
- sender address。
- sender name。
- optional reply-to。
- provider endpoint/region（如果服务需要）。

真实 Provider 尚未确定，因此本轮不增加 `RESEND_*`、`SENDGRID_*`、
`ALIYUN_*`、`SMTP_*` 或其他供应商特定环境变量，也不添加真实凭据。

`lib/auth/email/callbacks.ts` 只准备 Better Auth callback 到邮件消息的映射，
当前没有接入 `lib/auth/server.ts`。

## 官方 Migration

- 文件：`db/migrations/001_better_auth.sql`
- 数据库：PostgreSQL
- 来源：Better Auth `1.6.28` 官方 CLI Migration
- 核心表：`user`、`account`、`session`、`verification`
- 本轮没有修改 Schema，也没有手写新的 auth migration。

## 未来配置类别

下一阶段在启用对应能力前，需要由负责人确定：

- Email Provider 和 API/SMTP 凭据。
- Email sender/from、reply-to 和模板。
- 正式域名与 trusted origins。
- 多实例 shared rate-limit storage。
- CAPTCHA/Turnstile。

未来可选能力包括 OAuth、2FA 和 Passkey。未来业务后端需要单独确定服务
地址，例如最终约定的 `BUSINESS_BACKEND_URL`，但本轮不新增该环境变量。

## Better Auth 1.6.28 邮件能力结论

- Email Verification 和 Password Reset 使用 core 的 `verification` 存储。
- Email OTP plugin 使用同一个 core `verification` 存储，当前版本没有额外
  plugin schema。
- 未来真正启用 plugin 前仍应使用 Better Auth 官方 CLI 对最终配置做一次
  migration review；不得手写第二套认证 migration。
