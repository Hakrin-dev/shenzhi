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
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `config/auth.ts` | 是否强制 Email/Password 注册完成邮箱验证 | 默认 `false`；真实邮件 readiness 通过后生产设置为 `true` |
| `BUSINESS_BACKEND_URL` | `config/backend.ts` | 未来业务后端的服务端地址 | 未来业务后端实现时再填写 |
| `EMAIL_PROVIDER` | `config/email.ts` | 当前 Provider 选择；使用 `aliyun-directmail` | 配置 DirectMail 发送前填写 |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | `config/email.ts` | DirectMail API AccessKey ID | 仅由 Deployment Secrets 注入 |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | `config/email.ts` | DirectMail API AccessKey Secret | 仅由 Deployment Secrets 注入，不提交 Git |
| `ALIYUN_DIRECTMAIL_REGION_ID` | `config/email.ts` | DirectMail 区域 | 必须与发信地址所在区域匹配 |
| `ALIYUN_DIRECTMAIL_ENDPOINT` | `config/email.ts` | DirectMail OpenAPI endpoint | 显式配置，不依赖模糊默认值 |
| `AUTH_EMAIL_FROM` | `config/email.ts` | DirectMail `AccountName` 发信地址 | 必须是阿里云控制台已验证地址 |
| `AUTH_EMAIL_FROM_ALIAS` | `config/email.ts` | DirectMail `FromAlias` | 可选 |

`BETTER_AUTH_TRUSTED_ORIGINS` 会被裁剪并过滤空项，例如：

```text
https://example.com, https://admin.example.com
```

会规范化为两个 origin。未配置时不显式传入 Better Auth，以保持当前默认
行为。`NEXT_PUBLIC_API_URL` 当前没有运行时代码引用，不作为未来业务后端的浏览器
地址；浏览器也不应默认直接知道未来 Python/Go/Java 服务地址。

`AUTH_REQUIRE_EMAIL_VERIFICATION` 由通用 boolean parser 严格解析：未设置为 `false`，
首尾空格会被忽略，`true`/`false` 不区分大小写；空字符串及其他值会产生明确配置错误，
不会静默转换为 `true`。

## Email Provider configuration boundary

当前 Provider 已确定为 Alibaba Cloud DirectMail，代码使用官方
`@alicloud/dm20151123@1.10.2` SDK 的 `SingleSendMail` API（版本
`2015-11-23`）。

所有邮件发送配置从 `config/email.ts` 进入运行时代码：

- `EMAIL_PROVIDER=aliyun-directmail`：选择 Provider。
- `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET`：只从部署
  Secret 注入，不能进入源码、日志或 Git。
- `ALIYUN_DIRECTMAIL_REGION_ID` / `ALIYUN_DIRECTMAIL_ENDPOINT`：显式指定区域与
  endpoint，必须与发信地址所在区域一致。
- `AUTH_EMAIL_FROM`：映射到 `AccountName`，必须是 DirectMail 控制台已验证的发信地址。
- `AUTH_EMAIL_FROM_ALIAS`：可选，映射到 `FromAlias`。

配置不完整时 `createAuthEmailProvider()` 返回未配置状态，不会让开发服务器或 build
失败；只有触发 OTP、Verification 或 Reset 邮件发送时才返回配置错误。若
`AUTH_REQUIRE_EMAIL_VERIFICATION=true` 且 Provider 缺失，`/sign-up/email` 会在 Better
Auth 写入用户前返回 `EMAIL_PROVIDER_NOT_CONFIGURED`。Provider 不会输出 AccessKey、
邮件正文、OTP、token 或认证 URL。

`AUTH_REQUIRE_EMAIL_VERIFICATION=false` 映射为 `sendOnSignUp: false` 和
`requireEmailVerification: false`；设置为 `true` 时两个 Better Auth 选项同步为 `true`。
真实邮件联调和验收通过后，负责人只需修改 Deployment Secret，不需要修改认证源码。

## Current Better Auth configuration

`lib/auth/server.ts` 当前配置：

- `database`：来自 `lib/infrastructure/postgres.ts` 的 `pg.Pool`。
- 条件化的 `secret`、`baseURL` 和可选 `trustedOrigins`。
- `emailAndPassword.enabled`：`true`。
- `emailAndPassword.minPasswordLength`：`12`。
- `emailAndPassword.maxPasswordLength`：`64`。
- password hash/verify、Session、Cookie：Better Auth 默认实现。
- 注册、Reset Password、Change Password 的新密码组合规则：纯 policy 和 Better Auth
  官方 `hooks.before`。
- `emailVerification.sendVerificationEmail`、`emailVerification.sendOnSignUp`、
  `emailAndPassword.requireEmailVerification`、`emailAndPassword.sendResetPassword`、
  `emailOTP()` 以及浏览器 `emailOTPClient()`：均使用 Better Auth 官方 API；邮件发送
  由 Provider abstraction 承接。
- Email OTP：6 位、300 秒有效、3 次尝试，发送 rate limit 为 60 秒窗口最多 3 次；OTP
  在 Better Auth 的 `verification` 表中以 hash 保存。
- Reset Password：`revokeSessionsOnPasswordReset: true`。

Email Verification 强制注册默认关闭，由 `AUTH_REQUIRE_EMAIL_VERIFICATION` 控制。
本阶段不启用 CAPTCHA、OAuth、2FA、Passkey、RBAC、Redis 或业务身份协议配置。

## 官方 Migration

- 文件：`db/migrations/001_better_auth.sql`
- 数据库：PostgreSQL
- 来源：Better Auth `1.6.28` 官方 CLI Migration
- 核心表：`user`、`account`、`session`、`verification`
- Email OTP 复用 `verification`，本阶段没有修改 Schema，也没有手写新的 auth
  migration。

## 后续配置类别

下一阶段在启用对应能力前，需要负责人确定：

- 正式 Web URL/domain 与 `BETTER_AUTH_TRUSTED_ORIGINS`。
- DirectMail 控制台的 sender/domain 验证、AK/SK、sender/from、endpoint/region，并完成
  OTP/Verification/Reset 的真实邮件投递验收。
- 生产设置 `AUTH_REQUIRE_EMAIL_VERIFICATION=true`，并完成 OTP/Verification/Reset 邮件的
  真实投递验收；代码实现已完成，真实环境联调不属于本次代码实现。
- shared rate-limit storage（如果部署为多实例）。
- CAPTCHA/Turnstile。
- 未来业务后端服务地址 `BUSINESS_BACKEND_URL` 和语言无关的身份协议。

未来可选能力包括 OAuth、2FA 和 Passkey。若未来启用 Set Password 或其他创建新密码
入口，必须继续复用同一个 password policy。
