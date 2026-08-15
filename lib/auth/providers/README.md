# Better Auth Provider adapters

This directory is reserved for adapters between Better Auth callbacks and
external providers.

Future adapters may include:

- Email Provider;
- CAPTCHA Provider;
- other external services required by an enabled Better Auth plugin.

Provider adapters must only translate Better Auth callbacks to and from an
external service. They must not reimplement Better Auth verification, OTP,
password-reset token, session, cookie, or rate-limit logic.

The real providers and their credentials have not been selected yet.
