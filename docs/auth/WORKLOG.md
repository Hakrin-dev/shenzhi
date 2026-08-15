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
