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

- `auth.ts`: Better Auth secret, base URL, optional trusted origins, and the
  deployment-controlled email-verification requirement.
- `database.ts`: PostgreSQL connection URL.
- `email.ts`: Alibaba DirectMail provider selection and sender/deployment
  metadata; provider credentials remain deployment-only.
- `turnstile.ts`: Cloudflare Turnstile human-verification toggle, secret key,
  and optional token constraints.
- `backend.ts`: the future server-side business backend URL.

Do not import server configuration from Client Components. Only values with an
intentional `NEXT_PUBLIC_` contract may be exposed to browser code.
