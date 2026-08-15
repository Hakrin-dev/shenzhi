# Authentication Architecture

## Ownership boundary

ShenZhi keeps Better Auth `1.6.28` as its only authentication kernel. The
repository separates the browser UI, the Next.js/Better Auth server boundary,
the future business backend, and deployment configuration:

```text
User
 ↓
components/
  Frontend UI
 ↓
components/auth/auth-client.ts
  Browser Better Auth Client
 ↓
/api/auth/*
 ↓
app/api/auth/[...all]/route.ts
  HTTP boundary only
 ↓
lib/auth/server.ts
  Better Auth server instance
 ↓
Better Auth
 ├─ lib/infrastructure/postgres.ts
 │    ↓
 │  PostgreSQL
 │
 └─ lib/auth/providers/email/
      ↓
    future Email Provider
```

External deployment values flow separately:

```text
.env / deployment secrets
        ↓
      config/
       ├─ auth.ts
       ├─ database.ts
       ├─ email.ts
       └─ backend.ts
        ↓
    lib / services
```

`components/` never imports `lib/auth/server.ts`, PostgreSQL infrastructure,
or server-side configuration. The only shared exception is the pure password
policy module, which has no secrets, database, Better Auth, or UI dependencies.
The server side does not import browser Client modules.

## Frontend boundary

- `components/auth/login-modal.tsx` owns the current LoginModal UI.
- `components/layout/app-sidebar.tsx` owns Session-driven identity display and
  logout UI.
- `components/auth/auth-client.ts` is the single `createAuthClient()` export.
  It is a Client Component module and talks to the Better Auth HTTP API.
- Login and registration use Better Auth `signIn.email` and `signUp.email`.
- OTP UI remains visibly disabled; it does not call an OTP endpoint.
- The forgot-password control is a non-navigating placeholder. The legacy
  `app/reset-password/` page is not part of the current flow.

## Better Auth backend boundary

- `app/api/auth/[...all]/route.ts` only mounts
  `toNextJsHandler(auth)` and keeps the current GET/POST exports.
- `lib/auth/server.ts` is the only Better Auth server instance. It owns
  Email/Password, Session, Cookie, and Better Auth lifecycle behavior.
- `lib/auth/policies/password.ts` is a pure product rule. The official
  `hooks.before` checks only `/sign-up/email`; Better Auth still owns password
  length enforcement, hash, verify, credential storage, and Session.
- `lib/infrastructure/postgres.ts` only creates/exports the authentication
  `pg.Pool` using `config/database.ts`.
- `lib/auth/providers/` contains server-side external Provider contracts. It
  does not contain token, OTP, reset, verification, or Session logic.

Authentication model:

- `user.email` is the only login identifier.
- `user.name` is a display name.
- There is no username plugin, username credential, phone login, or SMS flow.
- Better Auth owns the `user`, `account`, `session`, and `verification` tables.
- No second auth API, repository, hash implementation, Session store, or
  migration exists.

## Password policy boundary

The composition rule is shared by the registration UI and the server hook,
but remains independent of Better Auth and the database. It checks for at
least one uppercase letter, lowercase letter, and digit. Better Auth continues
to enforce the 12–64 length range and all password cryptography/storage.

Reset Password, Change Password, and Set Password are not connected yet. When
any of those flows is enabled, every entry point that creates a new password
must reuse this same policy. This stage does not add alternate endpoints or
replace `databaseHooks` for the sign-up entry check.

## Email Provider boundary

```text
Better Auth callback data
  ↓
lib/auth/email/callbacks.ts
  ↓
lib/auth/email/messages.ts
  ↓
AuthEmailProvider.send(message)
  ↓
future real Email Provider
```

Better Auth creates and validates verification/reset tokens and OTP values.
ShenZhi only maps callback data to a small email message and delegates sending
to a provider. `lib/auth/server.ts` does not enable Email Verification, Email
OTP, Password Reset, or an email provider in this stage.

## Future business backend boundary

```text
Authenticated identity
  ↓
stable language-neutral identity contract
  ↓
services/backend/ adapter boundary
  ↓
BUSINESS_BACKEND_URL
  ↓
Python / Go / Java / TypeScript business service
```

`services/backend/` currently contains responsibility documentation only; it
does not implement a proxy, API, JWT, token exchange, or identity protocol.
The future business service must not read Better Auth `user`, `account`,
`session`, or `verification` tables, and must not depend on `pg.Pool` or
`lib/auth/server.ts`. The final protocol is a joint decision of the
authentication and business-backend owners.

Authentication and Authorization/RBAC remain separate concerns. RBAC is a
future product decision; this stage adds no role table, admin plugin, or
permission service.

## Schema and runtime boundary

The current core schema remains the official Better Auth migration at
`db/migrations/001_better_auth.sql`. Moving environment reads into `config/`
does not alter the PostgreSQL adapter, schema, routes, or accepted
Email/Password behavior. No Email Provider or pending email feature is
activated by this architecture change.
