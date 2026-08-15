# External configuration boundary

Deployment values flow from `.env` or the hosting environment through this
directory to the server-side modules that need them:

```text
.env / deployment secrets
        ↓
      config/
        ↓
    lib / services
```

The modules in this directory only read and normalize configuration. They do
not implement authentication, create database connections, send email, or
implement business services.

Configuration areas:

- `auth.ts`: Better Auth secret, base URL, and optional trusted origins.
- `database.ts`: PostgreSQL connection URL.
- `email.ts`: provider-neutral email provider and sender metadata; no
  provider-specific credentials are selected yet.
- `backend.ts`: the future server-side business backend URL.

Do not import server configuration from Client Components. Only values with an
intentional `NEXT_PUBLIC_` contract may be exposed to browser code.
