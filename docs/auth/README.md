# ShenZhi 认证

`docs/auth/` 是 ShenZhi 认证实现的正式文档目录。

## 当前决策

- Better Auth `1.6.28` 是唯一认证内核。
- 数据库使用 PostgreSQL，通过 `pg.Pool` 和 Better Auth 接入。
- 当前登录标识只有 email。
- `user.name` 只表示昵称/展示名称，不是 username credential。
- 不支持 username login、phone 或 SMS。
- 不自建 User、Credential、Session、Cookie、password hash、verification 或 OTP
  认证实现。

## 当前已完成

### Better Auth 基础设施

- Better Auth server instance、Next.js HTTP Handler 和唯一浏览器 Client。
- Email/Password，密码长度 12–64。
- Better Auth 默认 password hash/verify、Session 和 Cookie。
- PostgreSQL 与 Better Auth 官方 CLI Migration。
- sign-up、sign-in、get-session、sign-out、wrong-password 的 Runtime Acceptance。

### Frontend Auth v1

- LoginModal 的 Email/Password 登录调用 Better Auth `signIn.email`。
- 注册调用 Better Auth `signUp.email`，只提交 `name`、`email` 和 `password`。
- `lib/auth/policies/password.ts` 提供前后端共用的密码组合规则；服务端只通过
  Better Auth 官方 `hooks.before` 校验 `/sign-up/email`。
- Sidebar 使用真实 Better Auth Session 显示 `user.name` 或 email，并使用 `signOut`。
- 已移除没有有效引用的 Mock `stores/auth.ts`。
- 验证码登录 Tab 保留为明确 disabled 的 UI 占位，忘记密码保留为不跳转的占位按钮。

### Architecture Finalization

- `components/` 表示前端 UI 与浏览器认证适配器。
- `app/api/auth/[...all]/route.ts` 只表示 Next.js HTTP boundary。
- `lib/` 表示 Better Auth/server 侧集成、策略、Provider boundary 和基础设施。
- `config/` 统一读取和规范化外部部署配置。
- `services/backend/` 表示未来独立业务后端的责任边界。
- 配置来源移动不改变当前 Better Auth 认证行为。

### Stage 3A 邮件边界

- 已建立 provider-neutral 的认证邮件 Provider 契约和消息边界。
- 已审计 Better Auth `1.6.28` 的 Email Verification、Password Reset 和 Email OTP
  API。
- 没有绑定真实邮件供应商，也没有启用邮件认证插件或发送回调。

## 尚未完成

- 实际 Email Provider、Email Verification、Email OTP、Password Reset。
- Reset Password、Change Password、Set Password 的新密码策略接入；这些所有创建新密码
  的入口未来必须复用同一个 password policy。
- `app/reset-password/` 和 settings 中旧认证 UI 重做。
- trusted origins 的正式部署值、shared rate-limit storage、CAPTCHA。
- 未来业务后端的稳定身份协议以及 Authorization/RBAC 产品决策。
- 生产 PostgreSQL、Web 域名和业务后端地址配置。

详细内容见：

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CONFIGURATION.md](./CONFIGURATION.md)
- [EMAIL.md](./EMAIL.md)
- [WORKLOG.md](./WORKLOG.md)
