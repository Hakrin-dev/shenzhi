# ShenZhi Web · Agent 开发规范

## 目录职责

| 路径 | 职责 |
|------|------|
| `app/` | Next.js 路由薄入口 |
| `features/` | 页面实现与业务 UI（**主站 Agent 唯一 UI 栈**） |
| `components/` | layout、auth、通用 ui（不含 Agent 业务组件） |
| `lib/` | 公共客户端/服务端工具、API 封装、类型消费 |
| `types/` | 前后端契约（**单一来源**） |
| `modules/ai-agent-b/` | 遗留 B 模块；**仅 `/agents/b` 与 `/api/b` 实现**；公共能力应上提到 `lib/` |

## 公共组件规则

- 主站（`/`、`/search`、`/agents/ask`、`/agents`）只使用 `features/agents` + `@/lib/*`
- 禁止在 `features/` 直接 `import "@b/..."`（应使用 `@/lib` 或 `@/types`）
- 类型契约以 `types/ai-search.ts` 为准；B 模块 types 只做 re-export

## API 模式

| 环境变量 | 行为 |
|----------|------|
| `NEXT_PUBLIC_AI_BACKEND_MODE=B`（默认） | AI 走 `/api/b/*` |
| `NEXT_PUBLIC_AI_BACKEND_MODE=A` | AI 走 `/api/v1/*` → FastAPI |
| `BUSINESS_BACKEND_URL` | Next 转发 FastAPI 根地址（仅服务端） |

论文检索：`POST /api/v1/search/explore`（经 Next 代理 FastAPI）。

## UI

编辑首页、Composer、搜索、问 AI 时遵循 `.cursor/skills/shenzhi-ui/SKILL.md`。

## 本地运行

```bash
cd apps/web
pnpm install
pnpm dev
```

联调 FastAPI 时在 `.env.local` 设置 `BUSINESS_BACKEND_URL=http://127.0.0.1:8000`。
