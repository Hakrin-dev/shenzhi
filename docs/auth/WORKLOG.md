# Authentication Worklog

## Stage 1 — Better Auth Foundation

Stage 1 已完成并通过真实 Runtime Acceptance：

- Better Auth `1.6.28`。
- PostgreSQL 与 `pg.Pool`。
- Better Auth 官方 CLI Migration。
- Email/password，密码长度 12–64。
- sign-up、sign-in、get-session、sign-out、wrong-password。

认证行为由 Better Auth 提供。项目没有恢复 SQLite、custom credential、自定义
password hash、JWT、Session、username login 或 phone/SMS。

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

## Stage 3A — Email Provider Boundary

本阶段完成：

- 审计本机 Better Auth `1.6.28` 的 Email Verification、Password Reset 和 Email OTP
  实际 API。
- 建立 `AuthEmailMessage` 与 `AuthEmailProvider` 契约。
- 建立未配置 Provider 时的明确配置错误，不提供 console/mock/fallback provider。
- 建立 Verification、Password Reset、Email OTP 的最小消息 builder。
- 确认 Email OTP 使用 core `verification` 存储，当前版本没有额外 Schema。
- 没有绑定任何第三方邮件服务或新增供应商特定环境变量。

## Frontend Auth v1

本阶段完成：

- LoginModal 的 Email/Password 登录接入 Better Auth `signIn.email`。
- 注册接入 Better Auth `signUp.email`，使用 email 作为唯一登录标识，`name` 作为展示名称。
- 新增纯密码策略模块，覆盖 12–64 位以及大写、小写、数字组合规则。
- 使用 Better Auth `1.6.28` 官方 `hooks.before` 校验注册入口；Better Auth 继续负责
  password hash、verify、credential storage 和 Session。
- Sidebar 接入真实 `useSession`，显示 `user.name` 或 email，并使用 `signOut`。
- 移除无有效引用的 Mock `stores/auth.ts`，不保留第二套登录状态。

## Architecture Finalization

本阶段完成：

- 将唯一浏览器 Better Auth Client 移到 `components/auth/auth-client.ts`，删除旧的
  `lib/auth/client.ts`。
- 新增 `config/env.ts`、`config/auth.ts`、`config/database.ts`、`config/email.ts`、
  `config/backend.ts` 和交接说明；外部部署配置集中从 `config/` 进入服务端模块。
- 改为由 `config/database.ts` 向 PostgreSQL Pool 提供 `DATABASE_URL`，并由
  `config/auth.ts` 条件化提供 Better Auth secret、base URL 和 trusted origins。
- 收敛 `BUSINESS_BACKEND_URL` 的服务端业务后端边界；未实现假业务 API 或身份协议。
- 保持 Schema、Migration、Better Auth 版本和认证基础行为不变。

## Core User Authentication Flows

本阶段完成：

- 启用 Better Auth `1.6.28` 的 `emailOTP()` server plugin 与 `emailOTPClient()` browser
  plugin；LoginModal 的验证码发送和登录调用官方 API。
- 继续复用 provider-neutral Email Provider callback；Provider 未配置时只返回明确配置
  错误，不输出 OTP、token、reset URL 或 verification URL。
- 配置 Email Verification callback；由于 `emailDeliveryConfigured` 为 false，当前不强制
  注册邮箱验证，保持已验收的开发环境注册行为。
- 配置 Password Reset callback、`revokeSessionsOnPasswordReset`，并将真实
  `/reset-password` 页面接入 Better Auth request/reset API。
- 将同一纯 password policy 复用到注册、Reset Password 和 Change Password 的新密码入口；
  Better Auth 继续负责 hash、verify、credential storage 和 Session。
- Settings 接入真实 Session 的 name/email/验证状态、昵称更新、Change Password、列出会话
  和退出其他会话。
- 同步 `docs/auth/README.md`、`ARCHITECTURE.md`、`CONFIGURATION.md`、`EMAIL.md` 和本
  工作日志，明确区分代码已完成与真实邮件 Provider 待配置。

本阶段仍未完成：

- DirectMail 控制台 sender/domain 验证、部署 AK/SK、区域/endpoint 填写和真实邮件投递
  smoke test。
- 生产强制 Email Verification 的启用与真实邮箱验收。
- CAPTCHA、OAuth、2FA、Passkey、RBAC、业务身份协议和多实例 shared rate-limit storage。
- 如果未来启用 Set Password，仍需把该入口接入同一个 password policy。

## Alibaba Cloud DirectMail Provider

本阶段完成：

- 安装并固定官方 `@alicloud/dm20151123@1.10.2` SDK。
- 在 `lib/auth/providers/email/alibaba-directmail.ts` 建立 Alibaba DirectMail
  `SingleSendMail` adapter。
- 在 `config/email.ts` 集中读取 Provider、AccessKey、Region、Endpoint 和发信地址。
- 让 Email OTP、Email Verification、Password Reset 三个 Better Auth callback 共用
  `AuthEmailProvider`，不创建 OTP、verification token 或 reset token。
- 缺少邮件配置时保持开发服务器和 build 可用，仅在真实发送路径返回配置错误。
- 保持 `sendOnSignUp: false` 与 `requireEmailVerification: false`，没有改变当前注册行为。
- 增加 fake client 单元测试，覆盖请求映射、缺失配置和安全错误传播。

尚未完成：

- DirectMail 控制台 sender/domain、AK/SK、Region/Endpoint 的实际部署配置。
- 使用真实邮箱完成 OTP、Email Verification、Password Reset 投递验收。
- 真实投递验收通过后的生产强制邮箱验证启用。
