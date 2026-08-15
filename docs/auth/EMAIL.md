# Better Auth 1.6.28 Email Capabilities

本文件只记录当前项目实际安装的 Better Auth `1.6.28` API 和 ShenZhi 的责任边界，
不复制上游完整文档。

## Email Verification

Better Auth core option：

```ts
emailVerification: {
  sendVerificationEmail: async ({ user, url, token }, request?) => {},
  sendOnSignUp?: boolean,
  sendOnSignIn?: boolean,
  autoSignInAfterVerification?: boolean,
  expiresIn?: number,
}
```

当前 1.6.28 的实际责任划分：

- callback data 是 `{ user, url, token }`，第二个参数是可选 `Request`。
- Better Auth 创建 verification token 和 URL，并负责点击后的验证。
- `sendOnSignUp` 与 `emailAndPassword.requireEmailVerification` 当前都由
  `emailDeliveryConfigured` 控制，当前值为 `false`。
- `autoSignInAfterVerification` 没有显式启用；验证后的 Session 行为继续遵循
  Better Auth 默认行为。
- 未配置 Provider 时，当前开发环境注册不会被强制邮箱验证阻断；Provider 确定并完成
  投递验收后，才应在生产环境启用强制验证。

ShenZhi 只将 callback 提供的 URL 转换为邮件消息并交给 `AuthEmailProvider`，不生成、
存储或校验 token。

## Password Reset

Better Auth core option：

```ts
emailAndPassword: {
  sendResetPassword: async ({ user, url, token }, request?) => {},
  resetPasswordTokenExpiresIn?: number,
  onPasswordReset?: async ({ user }, request?) => {},
  revokeSessionsOnPasswordReset?: boolean,
}
```

当前 1.6.28 的责任划分：

- `POST /request-password-reset` 接收 email 和可选 `redirectTo`。
- Better Auth 生成 reset token，并使用 core `verification` 存储。
- `sendResetPassword` 收到 `{ user, url, token }`，只负责把已准备的内容交给邮件
  Provider。
- 默认 reset token 有效期为 3600 秒。
- 当前项目配置 `revokeSessionsOnPasswordReset: true`，成功重置后由 Better Auth 撤销
  该用户的现有 Session。
- `GET /reset-password/:token` 处理邮件链接并重定向到 callback URL；随后
  `POST /reset-password` 完成密码更新。
- `app/reset-password/page.tsx` 只收集 email 或新密码，并调用 Better Auth 官方
  request/reset API；不读取 verification 表、不校验 token、不更新 account 表。
- 请求页面使用不暴露账户存在性的成功提示；Provider 未配置时显示明确配置错误。

Reset Password 的新密码在 Better Auth 官方 `hooks.before` 中复用
`lib/auth/policies/password.ts`。Better Auth 仍负责长度、hash、verify 和存储。

## Email OTP

### Import paths

当前版本公开导出：

```ts
import { emailOTP } from "better-auth/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
```

Server plugin 的核心 callback：

```ts
sendVerificationOTP: async ({ email, otp, type }, context?) => {}
```

其中 `type` 当前为：

```text
sign-in | email-verification | forget-password | change-email
```

### 当前配置

- `otpLength`: 6。
- `expiresIn`: 300 秒，即 5 分钟。
- `allowedAttempts`: 3。
- Email OTP endpoint rate limit：60 秒窗口、最多 3 次。
- Better Auth 生成、存储、过期、限制尝试次数并验证 OTP；LoginModal 的 60 秒倒计时
  只是 UX。
- LoginModal 调用 `emailOtp.sendVerificationOtp({ email, type: "sign-in" })`，登录
  调用 `signIn.emailOtp({ email, otp })`。
- Browser client 通过 `emailOTPClient()` 暴露这些官方 API。

Provider 未配置时，发送请求会进入 `AuthEmailProvider` 的配置错误；不会假装发送成功，
也不会在日志输出 OTP。

### Schema 结论

当前 `emailOTP()` plugin 没有额外 `schema`；OTP 记录通过 Better Auth core
`verification` adapter 保存。因此当前 1.6.28 配置不需要第二张 OTP 表或额外字段。
启用新的 Better Auth plugin 或升级版本时，仍必须重新做官方 CLI migration review；若
官方明确产生 Schema diff，才生成官方 migration，不能手写平行认证 Schema。

## ShenZhi Email Provider boundary

```text
Better Auth callback
  ↓
lib/auth/email/callbacks.ts
  ↓
lib/auth/email/messages.ts
  ↓
AuthEmailProvider.send(message)
  ↓
未确定的第三方邮件服务
```

Verification、OTP、Password Reset 共用一个 Provider abstraction。当前 Provider、发件人、
凭据、endpoint/region 均未确定，没有真实发送，也没有 token/OTP/reset URL/
verification URL 日志。Provider 确定后，只补充 adapter 与配置，不重新实现 Better Auth
的 token、OTP、verification 或 Session 逻辑。
