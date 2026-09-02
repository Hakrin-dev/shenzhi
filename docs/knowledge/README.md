# 知识底座接入说明

> 知识底座（论文搜索 / 论文详情 / 论文关系图谱）接入 ShenZhi 的工程边界与当前进度。
> 相关代码：`apps/web/clients/knowledge`、`apps/web/features/knowledge/{search,paper,graph}`、`apps/backend/app/integrations/knowledge`。

## 整体调用链

```text
前端页面 / Component
        ↓
features/knowledge（search / paper / graph）
        ↓
apps/web/clients/knowledge（KnowledgeClient 接口 → Mock / BFF 实现）
        ↓
ShenZhi FastAPI（api/knowledge.py → services/knowledge.py）
        ↓
backend integrations/knowledge（client / schemas / adapter / exceptions）
        ↓
知识底座科研组 API
```

## 后端集成层（apps/backend/app/integrations/knowledge）

四类文件职责：

| 文件 | 职责 |
|---|---|
| `client.py` | 怎么调用知识底座科研 API：地址 / HTTP / Header / Timeout / Retry |
| `schemas.py` | 科研 API 自己的输入输出格式（snake_case） |
| `adapter.py` | 把科研数据转换为深知业务数据（camelCase 契约） |
| `exceptions.py` | 知识底座调用相关异常定义与转换 |
| `mock_data.py` | Mock 数据源与 Mock 客户端（真实接入前的降级实现） |

工厂 `get_knowledge_api()`：配置 `KNOWLEDGE_API_URL` 后走真实 HTTP 实现；未配置（当前阶段）使用 `MockKnowledgeApiClient`，Mock 与真实实现通过同一 `KnowledgeApiClient` 接口清晰区分。

后端 API 路由（`api/knowledge.py`）：

- `POST /api/v1/knowledge/search` — 论文搜索
- `GET  /api/v1/knowledge/paper?paperId=...` — 论文详情
- `GET  /api/v1/knowledge/graph?paperId=...&depth=1` — 论文关系图谱（默认 depth=1）

知识底座错误类别（`INVALID_ARGUMENT / NOT_FOUND / RATE_LIMITED / UPSTREAM_UNAVAILABLE / TIMEOUT / CONTRACT_VIOLATION / UNKNOWN`）由 `services/knowledge.py` 转换为深知业务错误码（21001–21007）。

## 真实 API 使用手册对齐

集成层 `schemas.py / client.py / adapter.py` 与《论文检索与知识图谱 API 使用手册》对齐：

| 能力 | 真实接口 | 集成层处理 |
|---|---|---|
| 论文检索 | `POST /api/retrieval/search` | 请求 `conference`（非 venue）；响应 `conference` → 业务 `venue`，`state/query_parse/query_rewrite` 忽略 |
| 论文详情 | `GET /api/kg/paper?paperId=...` | `venue / doi / pdf_url` 透传；引用数缺省为 `null`（≠0） |
| 关系图谱 | `GET /api/kg/graph?paperId=...&depth=N` | 真实返回 `rootId + nodes + lines(from/to/text/data)`；adapter 转 `edges(sourceId/targetId/relation)`，节点 `data.type` → `kind` |
| 服务状态 | `GET /api/health` | `client.health()`，不可用时映射 `UPSTREAM_UNAVAILABLE` |

手册中当前不在首批范围内、**未接入**：

- `POST /api/retrieval/multistep-search`（复杂关系检索，普通搜索用 `/api/retrieval/search`）
- `GET /api/kg/search`（简单标题检索；前端中心论文搜索复用 `search()` 即可）
- `GET /api/papers`、`/api/papers/venues`、`/api/papers/tracks`、`/api/categories`、`/api/conferences`（会议体系浏览）
- `/api/auth/*`、`/api/favorites`（知识底座登录/收藏）

真实联调时：后端配置 `KNOWLEDGE_API_URL=http://47.110.47.12` 即自动走 `HTTPKnowledgeApiClient`；若上游字段有出入，只需在 `adapter.py` 内收敛，不影响 API 层与前端契约。

## 前端客户端分层（apps/web/clients/knowledge）

| 文件 | 职责 |
|---|---|
| `types.ts` | 契约类型（Search / Detail / Graph / Error）与关系语义常量 |
| `client.ts` | `KnowledgeClient` 接口 + `KnowledgeClientError` |
| `mock.ts` | `MockKnowledgeClient`：模拟 success / zero_results / loading / timeout / upstream_unavailable / not_found |
| `bff.ts` | `BffKnowledgeClient`：真实联调时走 ShenZhi FastAPI（`/api/v1/knowledge/*`） |
| `index.ts` | 工厂 `getKnowledgeClient()`：默认 Mock；设 `NEXT_PUBLIC_KNOWLEDGE_SOURCE=bff` 切换 BFF |

页面只依赖 `KnowledgeClient` 接口，不直接 import mock 数据，因此真实联调时仅需切换工厂实现，页面无需大改。

## Contract 要点

- **id 是 opaque string**，禁止解析内部格式
- `authors` 可能为空、`subjects` 上游覆盖不足、`score` 不是百分比
- **`citationCount === null` 表示上游未提供**，UI 不得显示为 `0`（显示 `—` / 隐藏）
- `kind` / `relation` 是开放字符串，未知类型必须有默认展示，禁止 `switch ... default: throw`
- **CITES 语义**：`sourceId` 引用了 `targetId`；`sourceId===root` → References，`targetId===root` → Citations，列表与图谱筛选统一按此规则
- 图谱默认 `depth=1`，不要默认 `depth=2`

Mock 错误演示：搜索框输入 `timeout` / `不可用` / `未找到` / `无结果` 等关键词可触发对应状态。

## 页面路由

| 路由 | 页面 |
|---|---|
| `/knowledge/search` | 论文检索（搜索 + 筛选 + 结果 + 状态） |
| `/knowledge/search/[paperId]` | 论文详情 |
| `/knowledge/search/[paperId]/graph` | 论文关系图谱（三栏工作台） |

图谱工作台为三栏：左（中心论文搜索 + 关联论文 + References/Citations 方向筛选）、中（SVG 图谱，支持环形 / 横向树 / 纵向树 / 力导向布局与深度 1–3）、右（节点详情，Paper 节点拉取详情，实体节点展示元信息）。

## 当前阶段与真实联调

- 当前使用 Mock 数据源（前端 `MockKnowledgeClient` + 后端 `MockKnowledgeApiClient`），页面与交互可独立开发联调
- 后续真实联调：
  1. 后端配置 `KNOWLEDGE_API_URL`（与科研组 API 汇合）
  2. 前端设置 `NEXT_PUBLIC_KNOWLEDGE_SOURCE=bff`
  3. 如科研侧字段变化，只在 `adapter.py` 内收敛，不动 API 层与前端

## 首批业务范围（当前实现）

- 论文搜索 → 论文详情 → 论文关系图谱
- 暂不做：会议浏览 / 专利 / 学者 / 项目 / 基金 / multistep / 复杂关系查询 / 知识底座登录收藏
