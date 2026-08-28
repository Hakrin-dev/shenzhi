# ShenZhi 工程架构说明

## 总体结构

```text
apps/web/          Next.js 前端 + BFF
apps/backend/      FastAPI 业务后端（目标态 AI/检索/会话）
docs/              产品、Auth、工程文档
```

## 请求路径

### 鉴权

```text
Browser → /api/auth/* → Better Auth → PostgreSQL
```

### AI 与检索

```text
Browser → /api/v1/*  → Next forward → FastAPI     (模式 A)
Browser → /api/b/*   → Next Route Handlers        (模式 B，当前默认)
```

### 主站页面栈

| 路由 | 实现 |
|------|------|
| `/`、`/search` | `features/search` + `features/agents/composer` |
| `/agents/ask` | `features/agents/ask` + `@/lib/ask/use-ask-session` |
| `/agents` | `features/agents/components/agent-chat` |
| `/agents/b` | `modules/ai-agent-b`（待合并退役） |

## 阶段二待解决边界

1. Auth 用户身份贯通到 Chat（`X-Shenzhi-User-Id`）
2. Chat 会话持久化统一到 PostgreSQL（避免平行 SQLite/Prisma 长期并存）
3. 匿名与登录用户数据归属规则
4. Search / 联网 / 附件能力边界梳理

## 公共层收敛原则

- 契约：`types/ai-search.ts`
- 客户端 API：`lib/api/*`
- Agent UI：`features/agents/components/*`
- B 模块仅保留 `/agents/b` 与 `/api/b` 实现，公共代码上提到 `lib/`
