# Future business backend boundary

This directory represents the ShenZhi business service boundary after login.
It currently contains responsibility documentation only; no business API or
adapter is implemented here.

The business backend is not implemented yet. It may use Python, Go, Java,
TypeScript, or another technology stack in the future.

The intended future boundary is:

```text
Frontend
  ↓
Next.js application/API boundary
  ↓
apps/web/services/backend/ adapter
  ↓
BUSINESS_BACKEND_URL
  ↓
Python / Go / Java / TypeScript business service
```

The browser must not directly depend on an internal business-service URL.
When an adapter is implemented, it belongs at this boundary and should use a
stable, language-neutral contract.

Future business services must not read Better Auth's internal `user`,
`account`, `session`, or `verification` tables. They must not depend on
Better Auth internals, `pg.Pool`, or `apps/web/lib/auth/server.ts`.

Authenticated identity will be passed through a stable, language-neutral
HTTP, JSON, or signed identity contract. The final identity protocol must be
agreed by the business-backend and authentication owners before
implementation.
