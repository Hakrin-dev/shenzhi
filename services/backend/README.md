# Business backend boundary

This directory represents the ShenZhi business service boundary after login.

The business backend is not implemented yet. It may use Python, Go, Java,
TypeScript, or another technology stack in the future.

Future business services must not read Better Auth's internal `user`,
`account`, `session`, or `verification` tables. They must not depend on
Better Auth internals, `pg.Pool`, or `lib/auth/server.ts`.

Authenticated identity will be passed through a stable, language-neutral
HTTP, JSON, or signed identity contract. The final identity protocol must be
agreed by the business-backend and authentication owners before
implementation.
