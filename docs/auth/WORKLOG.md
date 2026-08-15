# Authentication Worklog

## Stage 1 — Better Auth Foundation

Stage 1 已完成并通过真实 Runtime Acceptance：

- Better Auth `1.6.28`。
- PostgreSQL 与 `pg.Pool`。
- Better Auth 官方 CLI Migration。
- Email/password，密码长度 12–64。
- sign-up、sign-in、get-session、sign-out、wrong-password。

认证行为由 Better Auth 提供。项目没有恢复 SQLite、custom credential、
自定义 password hash、JWT、Session、username login 或 phone/SMS。

## Stage 2 — Architecture Boundary

本阶段完成：

- 将 Better Auth server instance 整理到 `lib/auth/server.ts`。
- 将 PostgreSQL Pool 抽离到 `lib/infrastructure/postgres.ts`。
- 保持 `/api/auth/[...all]` 路径和当前 GET/POST 导出不变。
- 建立 `lib/auth/providers/` 外部 Provider adapter 边界。
- 建立 `services/backend/` 未来业务后端责任边界。
- 将正式认证文档纳入 `docs/auth/`。
- 清理已经废弃的 custom auth / SQLite 认证文档。
- 将 Better Auth 依赖固定为 `1.6.28`，避免未经单独审计的版本漂移。

初始阶段的浏览器 Client 位于 `lib/auth/client.ts`；后续 Frontend Auth v1
完成真实 UI 接线，Architecture Finalization 再将它移动到
`components/auth/auth-client.ts`，使前端/服务端职责最终分开。

## Stage 3A — Email Provider Boundary

本阶段完成：

- 审计本机 Better Auth `1.6.28` 的 Email Verification、Password Reset 和
  Email OTP 实际 API。
- 建立 `AuthEmailMessage` 与 `AuthEmailProvider` 契约。
- 建立未配置 Provider 时的明确配置错误，不提供 console/mock/fallback provider。
- 建立 Verification、Password Reset、Email OTP 的最小消息 builder。
- 建立 Better Auth callback 到 Provider 的准备层，但没有接入 `server.ts`。
- 确认 Email OTP 使用 core `verification` 存储，当前版本没有额外 Schema。
- 没有绑定任何第三方邮件服务或新增供应商特定环境变量。
- 没有修改 Migration、UI 或认证行为。

本阶段尚未启用：

- 实际 Email Provider、Email Verification、Email OTP、Password Reset。
- 前端邮件认证 UI。

## Frontend Auth v1

本阶段完成：

- LoginModal 的 Email/Password 登录接入 Better Auth `signIn.email`。
- 注册接入 Better Auth `signUp.email`，使用 email 作为唯一登录标识，`name` 作为展示名称。
- 新增纯密码策略模块，覆盖 12–64 位以及大写、小写、数字组合规则。
- 使用 Better Auth `1.6.28` 官方 `hooks.before` 只校验 `/sign-up/email`；Better Auth
  继续负责 password hash、verify、credential storage 和 Session。
- Sidebar 接入真实 `useSession`，显示 `user.name` 或 email，并使用 `signOut`。
- 移除无有效引用的 Mock `stores/auth.ts`，不保留第二套登录状态。
- 保留验证码登录 Tab 为明确 disabled 的 UI 占位，不实现假 OTP。
- 忘记密码入口改为不跳转旧 reset 页面的占位按钮；旧 reset 页面本阶段未修改。
- 使用 Node `node:test` 配合现有 TypeScript 编译验证密码策略，不新增测试框架或依赖。

## Architecture Finalization

本阶段完成：

- 将唯一浏览器 Better Auth Client 移到 `components/auth/auth-client.ts`，删除旧的
  `lib/auth/client.ts`，并更新 LoginModal/Sidebar 引用。
- 新增 `config/env.ts`、`config/auth.ts`、`config/database.ts`、`config/email.ts`、
  `config/backend.ts` 和交接说明；外部部署配置集中从 `config/` 进入服务端模块。
- 改为由 `config/database.ts` 向 PostgreSQL Pool 提供 `DATABASE_URL`。
- 改为由 `config/auth.ts` 条件化提供 Better Auth secret、base URL 和 trusted origins，
  未配置时保留 Better Auth 默认行为。
- 保留 provider-neutral 邮件配置入口，但没有启用邮件发送或任何邮件认证功能。
- 收敛 `BUSINESS_BACKEND_URL` 的服务端业务后端边界；未实现假业务 API 或身份协议。
- 同步认证架构、配置、README 和本工作日志；`EMAIL.md` 经检查后保持不变，因为本阶段
  没有改变邮件能力。
- 新增 `config/env.ts` 的 Node `node:test`，与密码策略测试一起通过。

本阶段没有修改 Schema、Migration、认证 endpoint、Better Auth 版本或认证行为。

## 当前待办

- 实际 Email Provider、发件人和凭据配置。
- Email Verification、Email OTP server/client plugin 和真实发送流程。
- Password Reset activation，以及 Reset/Change/Set Password 的新密码策略接入。
- trusted origins 正式值、CAPTCHA、生产 DB、生产 server/domain、shared rate-limit storage。
- 未来业务后端身份协议与业务 Authorization/RBAC 决策。
