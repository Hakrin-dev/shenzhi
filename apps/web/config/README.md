# External configuration boundary

Deployment values flow from `.env` or the hosting environment through this
directory to the server-side modules that need them:

```text
.env / deployment secrets
        ↓
      apps/web/config/
        ↓
    apps/web/lib / apps/web/services
```

The modules in this directory only read and normalize configuration. They do
not implement authentication, create database connections, send email, or
implement business services.

Configuration areas:

- `auth.ts`: Better Auth secret, base URL, optional trusted origins, and the
  fixed safeguards used by the staged email-first registration flow.
- `database.ts`: PostgreSQL connection URL.
- `email.ts`: Alibaba DirectMail provider selection and sender/deployment
  metadata; provider credentials remain deployment-only.
- `oauth.ts`: OAuth Provider 注册表；每个 Provider 读取各自的
  `{大写ID}_CLIENT_ID` / `{大写ID}_CLIENT_SECRET`，缺失配置在启动时被容忍，
  仅在该 Provider 登录被触发时才报未配置。
- `turnstile.ts`: Cloudflare Turnstile human-verification toggle, secret key,
  and optional token constraints.
- `backend.ts`: FastAPI 根地址 `BUSINESS_BACKEND_URL`（仅服务端）。

Do not import server configuration from Client Components. Only values with an
intentional `NEXT_PUBLIC_` contract may be exposed to browser code.
