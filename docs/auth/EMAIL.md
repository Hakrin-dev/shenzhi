# Better Auth 1.6.28 Email Capability Audit

本文件只记录当前项目实际安装的 Better Auth `1.6.28` API 和 ShenZhi 的
责任边界，不复制上游完整文档。

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

当前 1.6.28 类型中的行为：

- `sendVerificationEmail` callback data 是 `{ user, url, token }`，第二个参数
  是可选 `Request`。
- `sendOnSignUp` 默认未显式设置；未设置时跟随
  `emailAndPassword.requireEmailVerification`。
- `sendOnSignIn` 默认关闭。
- verification token 默认有效期为 3600 秒。
- `emailAndPassword.requireEmailVerification` 控制未验证用户是否不能创建登录
  Session。
- `autoSignInAfterVerification` 只有显式启用时才由 Better Auth 自动建立/更新
  Session。

Better Auth 创建 verification token 和 verification URL，并负责后续验证。URL
和 token 传给 ShenZhi callback；ShenZhi 只构造邮件并交给 Provider，不生成或
校验 token。

本阶段没有设置 `emailVerification`，也没有启用
`requireEmailVerification`，避免未配置真实 Provider 时改变当前 sign-up 行为。

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
- Better Auth 生成 reset token，并将其放入 core `verification` 存储。
- `sendResetPassword` 收到 `{ user, url, token }`，只负责把已准备的内容发送出去。
- 默认 reset token 有效期为 3600 秒。
- `revokeSessionsOnPasswordReset` 默认关闭；当前项目没有配置它。
- `onPasswordReset` 是密码成功更新后的 Better Auth callback。
- `GET /reset-password/:token` 负责处理链接，再由 `POST /reset-password` 完成
  密码更新。

当前不接入 `app/reset-password/page.tsx`，不改变既有 UI 或 Session 行为。

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

### 当前默认值

Better Auth 1.6.28 的 `EmailOTPOptions` 默认值为：

- `otpLength`: 6。
- `expiresIn`: 300 秒，即 5 分钟。
- `allowedAttempts`: 3。
- `sendVerificationOnSignUp`: false。
- `disableSignUp`: false。
- `overrideDefaultEmailVerification`: false。
- OTP storage: `plain`，除非显式配置其他存储方式。
- plugin endpoint rate limit: 60 秒窗口、最多 3 次。

OTP 由 Better Auth 生成、存储、过期、尝试次数控制和验证。ShenZhi 的
`buildEmailOtpMessage()` 只使用 callback 给出的 OTP 生成邮件内容。

### 当前 endpoint

与本项目当前 email-only 模型相关的 endpoint 包括：

- `POST /email-otp/send-verification-otp`。
- `POST /sign-in/email-otp`。
- `POST /email-otp/verify-email`。
- `POST /email-otp/request-password-reset`。
- `POST /forget-password/email-otp`。
- `POST /email-otp/reset-password`。
- 以及检查 OTP、邮箱变更等辅助 endpoint。

Email OTP client plugin 只有在未来浏览器真正使用 OTP client API 时才需要加入
`createAuthClient({ plugins: [emailOTPClient()] })`。本阶段不启用 server 或
client plugin。

### Schema 结论

当前 `emailOTP()` plugin 对象没有额外 `schema`，源码中的 OTP 记录通过
Better Auth core verification adapter 保存。因此以当前 1.6.28 实现判断，启用
Email OTP 不需要新增第二张 OTP 表或额外字段。

启用前仍需对最终 plugin 配置运行 Better Auth 官方 CLI migration review；如果
未来版本或其他 plugin 引入 schema，必须重新生成官方 migration，不能手写平行
认证 Schema。

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

当前 Provider、发件人、凭据、endpoint/region 均未确定。没有真实发送、日志
输出 OTP/token，也没有把 callback 接入 `lib/auth/server.ts`。
