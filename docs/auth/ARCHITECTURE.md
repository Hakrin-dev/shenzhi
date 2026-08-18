# Authentication Architecture

## Ownership boundary

ShenZhi keeps Better Auth `1.6.28` as its only authentication kernel. The
repository separates the browser UI, the Next.js/Better Auth server boundary,
the future business backend, and deployment configuration:

```text
User
 ↓
apps/web/components/
  Frontend UI
 ↓
apps/web/components/auth/auth-client.ts
  Browser Better Auth Client
 ↓
/api/auth/*
 ↓
apps/web/app/api/auth/[...all]/route.ts
  HTTP boundary only
 ↓
apps/web/lib/auth/server.ts
  Better Auth server instance
 ↓
Better Auth
 ├─ apps/web/lib/infrastructure/postgres.ts
 │    ↓
 │  PostgreSQL
 │
 └─ apps/web/lib/auth/email/callbacks.ts
      ↓
   AuthEmailProvider
      ↓
   apps/web/lib/auth/providers/email/factory.ts
       ↓
   AlibabaDirectMailProvider
       ↓
   Alibaba Cloud DirectMail SingleSendMail
```

External deployment values flow separately:

```text
.env / deployment secrets
        ↓
      apps/web/config/
       ├─ auth.ts
       ├─ database.ts
       ├─ email.ts
       └─ backend.ts
        ↓
    apps/web/lib / apps/web/services
```

`apps/web/components/` never imports `apps/web/lib/auth/server.ts`, PostgreSQL infrastructure,
or server-side configuration. The only shared exception is the pure password
policy module, which has no secrets, database, Better Auth, or UI dependencies.
The server side does not import browser Client modules.

## Frontend boundary

- `apps/web/components/auth/login-modal.tsx` owns the current LoginModal UI.
- `apps/web/components/layout/app-sidebar.tsx` owns Session-driven identity display and
  logout UI.
- `apps/web/components/auth/auth-client.ts` is the single `createAuthClient()` export.
  It is a Client Component module and talks to the Better Auth HTTP API.
- Login and registration use Better Auth `signIn.email` and `signUp.email`.
- The OTP UI uses the official `emailOTPClient()` methods for sending and
  signing in. The client-side 60-second countdown is UX only; Better Auth
  remains responsible for OTP generation, expiry, attempts, and rate limits.
- The forgot-password control opens the real `/reset-password` flow, which
  calls Better Auth request/reset endpoints without reading the verification
  table in application code.
- Settings uses the Better Auth session for profile display, `updateUser`,
  `changePassword`, `listSessions`, and `revokeOtherSessions`.
- GitHub 登录使用 Better Auth `signIn.social()`；浏览器不读取 OAuth secret。
- Email OTP 登录与注册发送验证码时，可先渲染 Cloudflare Turnstile 并把一次性 token
  交给服务端验证。

## Better Auth backend boundary

- `apps/web/app/api/auth/[...all]/route.ts` only mounts
  `toNextJsHandler(auth)` and keeps the current GET/POST exports.
- `apps/web/lib/auth/server.ts` is the only Better Auth server instance. It owns
  Email/Password, Email OTP, Email Verification and Password Reset callbacks,
  Session, Cookie, Better Auth lifecycle behavior, and the deployment-controlled
  email-verification requirement.
- `AUTH_REQUIRE_EMAIL_VERIFICATION` is parsed in `apps/web/config/auth.ts` and mapped to
  both Better Auth `emailVerification.sendOnSignUp` and
  `emailAndPassword.requireEmailVerification`. `server.ts` does not read
  `process.env` directly.
- `apps/web/lib/auth/policies/password.ts` is a pure product rule. The official
  `hooks.before` checks new passwords at `/sign-up/email`, `/reset-password`,
  and `/change-password`; Better Auth still owns password length enforcement,
  hash, verify, credential storage, and Session.
- `apps/web/lib/infrastructure/postgres.ts` only creates/exports the authentication
  `pg.Pool` using `apps/web/config/database.ts`.
- `apps/web/lib/auth/providers/` contains server-side external Provider contracts. It
  does not contain token, OTP, reset, verification, or Session logic.
- GitHub OAuth provider 仅在 client ID/secret 同时存在时启用；未配置不会阻止应用启动。
- `apps/web/lib/auth/captcha/turnstile.ts` 只在显式启用且存在 secret 时保护 Email OTP
  发送端点，并在 Cloudflare 校验失败时 fail closed。

Authentication model:

- `user.email` is the only login identifier.
- `user.name` is a display name.
- There is no username plugin, username credential, phone login, or SMS flow.
- Better Auth owns the `user`, `account`, `session`, and `verification` tables.
- No second auth API, repository, hash implementation, Session store, or
  migration exists.

## Password policy boundary

The composition rule is shared by the registration, Reset Password, and Change
Password UI and the server hook, but remains independent of Better Auth and the
database. It checks for at least one uppercase letter, lowercase letter, and
digit. Better Auth continues to enforce the 12–64 length range and all password
cryptography/storage.

If Set Password or another future entry point creates a new password, it must
reuse this same policy. No database hook or custom password implementation is
used as a replacement for the official authentication entry-point hook.

## Email capability boundary

```text
Better Auth callback data
  ↓
apps/web/lib/auth/email/callbacks.ts
  ↓
apps/web/lib/auth/email/messages.ts
  ↓
AuthEmailProvider.send(message)
  ↓
apps/web/lib/auth/providers/email/factory.ts
  ↓
AlibabaDirectMailProvider
  ↓
Alibaba DirectMail SingleSendMail
```

Better Auth creates and validates verification/reset tokens and OTP values.
ShenZhi only maps callback data to a small email message and delegates sending
to a provider. The official Email OTP server/client plugins are enabled, and
the Alibaba DirectMail adapter is selected only when all required deployment
configuration is present. An unconfigured provider leaves application startup
and build available, then raises a clear configuration error when a delivery
path is invoked. When `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, the additional
`/sign-up/email` guard runs before Better Auth persists a user. It never logs a
token, OTP, or complete authentication URL.

`apps/web/lib/auth/server.ts` depends only on `createAuthEmailProvider()` and the
provider-neutral callbacks. It does not import `SingleSendMailRequest`, access
keys, endpoint values, or any Alibaba SDK type. This keeps a future SES,
Resend, or other adapter replacement outside Better Auth configuration.

Email Verification remains an explicit Better Auth capability. The default
configuration is `AUTH_REQUIRE_EMAIL_VERIFICATION=false`, which keeps both
`sendOnSignUp` and `requireEmailVerification` false. Production can set the
flag to `true` after successful real-mail readiness and smoke testing. This
switch only changes Email/Password registration and sign-in enforcement;
Email OTP continues to use its official plugin path, and Password Reset keeps
its independent callback.

## Future business backend boundary

```text
Authenticated identity
  ↓
Next.js /api/v1 BFF  (apps/web/services/backend/forward.ts)
  ↓
X-ShenZhi-User-Id / X-ShenZhi-User-Email
  ↓
BUSINESS_BACKEND_URL
  ↓
Python FastAPI  (apps/backend)
```

The browser must not call FastAPI directly. FastAPI must not read Better Auth `user`, `account`, `session`, or `verification` tables, and must not depend on `pg.Pool` or `apps/web/lib/auth/server.ts`. See `docs/dev/前后端通信架构.md`.

Authentication and Authorization/RBAC remain separate concerns. RBAC is a
future product decision; this stage adds no role table, admin plugin, or
permission service.

## Schema and runtime boundary

The current core schema remains the official Better Auth migration at
`apps/web/db/migrations/001_better_auth.sql`. Email OTP reuses Better Auth's core
`verification` storage and does not add a second OTP table. The current stage
does not modify the migration or introduce a second authentication schema.
