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

## Stage 3A 已完成

- 建立 provider-neutral 的认证邮件 Provider 契约和消息边界。
- 审计 Better Auth `1.6.28` 的 Email Verification、Password Reset 和 Email OTP API。
- 没有绑定真实邮件供应商，也没有启用邮件认证插件或发送回调。

## Frontend Auth v1 已完成

- LoginModal 的 Email/Password 登录调用 Better Auth `signIn.email`。
- 注册调用 Better Auth `signUp.email`，只提交 `name`、`email` 和 `password`。
- `lib/auth/policies/password.ts` 提供前后端共用的密码组合规则；12–64 位长度继续由
  Better Auth 配置负责。
- `lib/auth/server.ts` 通过 Better Auth 官方 `hooks.before` 只拦截 `/sign-up/email`，
  由 Better Auth 继续负责密码哈希、存储和 Session。
- Sidebar 使用真实 Better Auth Session 显示 `user.name`，并使用 `signOut` 退出。
- 移除没有有效引用的 Mock `stores/auth.ts`。
- 保留验证码登录 Tab，但获取验证码和登录操作均为明确 disabled 占位。
- 保留忘记密码入口为不跳转的占位按钮。

## 尚未完成

- 实际 Email Provider、Email Verification、Email OTP、Password Reset。
- Reset Password、Change Password、Set Password 的新密码策略接入；这些入口未来必须
  复用同一个 password policy。
- `app/reset-password/` 和 settings 中旧的认证 UI 重做。
- trusted origins、shared rate-limit storage、CAPTCHA。
- 未来业务后端身份协议。

详细内容见：

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CONFIGURATION.md](./CONFIGURATION.md)
- [EMAIL.md](./EMAIL.md)
- [WORKLOG.md](./WORKLOG.md)
