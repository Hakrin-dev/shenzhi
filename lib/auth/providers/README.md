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
Better Auth callback boundary and message content. `lib/auth/server.ts` only
resolves the provider-neutral factory; provider-specific SDK details stay in
the adapter implementation.

Alibaba Cloud DirectMail is the current provider implementation. It uses the
official `@alicloud/dm20151123` SDK and `SingleSendMail`; no console, mock, or
fallback provider is supplied. Missing deployment configuration leaves the
application startable and fails only when a mail delivery path is invoked.
