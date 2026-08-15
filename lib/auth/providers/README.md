# Better Auth Provider adapters

`email/` contains the provider-neutral email contract used by future Better
Auth email callbacks.

The contract is intentionally small:

- `AuthEmailMessage` describes the already-prepared recipient, subject, text,
  and optional HTML body.
- `AuthEmailProvider.send()` delivers that message to an external service.
- `requireAuthEmailProvider()` fails clearly when no provider has been
  configured.

Provider adapters must only translate Better Auth callbacks to and from an
external service. They must not reimplement Better Auth verification, OTP,
password-reset token, session, cookie, or rate-limit logic.

`lib/auth/email/callbacks.ts` and `lib/auth/email/messages.ts` prepare the
Better Auth callback boundary and message content, but they are not wired into
`lib/auth/server.ts` in this stage. This keeps the already accepted email/
password behavior unchanged.

The real provider, sender identity, endpoint, region, and credentials have not
been selected yet. No console, mock, or fallback provider is supplied.
