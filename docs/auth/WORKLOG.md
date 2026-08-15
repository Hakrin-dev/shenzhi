# Authentication Worklog

## Stage 1 — Better Auth Foundation

Stage 1 已完成并通过真实 Runtime Acceptance：

- Better Auth `1.6.28`。
- PostgreSQL 与 `pg.Pool`。
- Better Auth 官方 CLI Migration。
- Email/password，密码长度 12–64。
- sign-up。
- sign-in。
- get-session。
- sign-out。
- wrong-password。

认证行为由 Better Auth 提供。项目没有恢复 SQLite、custom credential、
自定义 password hash、JWT、Session、username login 或 phone/SMS。

## Stage 2 — Architecture Boundary

本轮完成：

- 将 Better Auth server instance 整理到 `lib/auth/server.ts`。
- 将浏览器 Client 整理到 `lib/auth/client.ts`。
- 将 PostgreSQL Pool 抽离到 `lib/infrastructure/postgres.ts`。
- 保持 `/api/auth/[...all]` 路径和当前 GET/POST 导出不变。
- 建立 `lib/auth/providers/` 外部 Provider adapter 边界。
- 建立 `services/backend/` 未来业务后端责任边界。
- 将正式认证文档纳入 `docs/auth/`。
- 清理已经废弃的 custom auth / SQLite 认证文档。
- 将 Better Auth 依赖固定为 `1.6.28`，避免未经单独审计的版本漂移。

本轮没有接入 UI、Email Provider、Email Verification、Email OTP、Password
Reset、CAPTCHA、JWT、业务后端或新的认证 API。

## 后续工作

- Email Provider。
- Email Verification。
- Email OTP。
- Password Reset。
- password composition policy。
- trusted origins。
- shared rate-limit storage。
- CAPTCHA。
- LoginModal 和 Sidebar 的真实 Session 接线。
- Mock store removal。
- 跨语言 business identity protocol。

## Stage 3A — Email Provider Boundary

本阶段完成：

- 审计本机 Better Auth `1.6.28` 的 Email Verification、Password Reset 和
  Email OTP 实际 API。
- 建立 `AuthEmailMessage` 与 `AuthEmailProvider` 契约。
- 建立未配置 Provider 时的明确配置错误，不提供 console/mock/fallback provider。
- 建立 Verification、Password Reset、Email OTP 的最小消息 builder。
- 建立 Better Auth callback 到 Provider 的准备层，但没有接入 `server.ts`。
- 确认 Email OTP 使用 core `verification` 存储，当前版本没有额外 Schema。
- 没有绑定任何第三方邮件服务或新增环境变量。
- 没有修改 Migration、UI 或认证行为。

本阶段尚未完成：

- 实际 Email Provider。
- Email Verification activation。
- Password Reset activation。
- Email OTP activation。
- 前端邮件认证 UI 接线。

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
- 忘记密码入口改为不跳转旧 reset 页面的占位按钮；旧 reset 页面本轮未修改。
- 使用 Node `node:test` 配合现有 TypeScript 编译验证密码策略，不新增测试框架或依赖。

本阶段尚未完成：

- 实际 Email Provider、发件人和凭据配置。
- Email Verification activation。
- Email OTP server/client plugin 和真实发送流程。
- Password Reset activation，以及 Reset/Change/Set Password 的新密码策略接入。
- CAPTCHA、生产 DB、生产 server/domain、shared rate-limit storage。
- 业务后端身份协议以及业务授权逻辑。
