# Chat 维护指南

## 架构与边界

```text
app/agents/page.tsx 或 app/agents/ask/page.tsx（URL 兼容）
  → features/chat/ChatPage / ask/AskPage
  → AgentChat + ChatThread + Composer
  → components/common/layout/SidebarChatHistory（主侧栏唯一历史入口）
  → hooks/use-chat-session（UI 状态、取消、历史恢复、防止过期请求写入）
  → services/conversation（建会话/续问编排、历史数据适配）
  → services/local-history（仅后端不可用时的浏览器降级缓存，见下文）
  → clients/backend/{chat,http,sse,uploads,search}
  → Next.js app/api/v1/[...path] → clients/backend/forward（BFF）
  → FastAPI api/{chat,search,uploads}
  → services/chat
      ├─ model_provider（OpenAI-compatible HTTP）
      ├─ retrieval（保留 dev 论文检索接口）
      ├─ web_search（Tavily → SearXNG）
      ├─ document_parser / upload_reader
      └─ sessions（临时 Repository）
```

- 页面只组合 Feature；Chat 专用 UI 在 `features/chat/components`。
- Deep Research / Auto Research 独立于 Chat，不改算法。
- `/agents/deep-search` 是既有静态搜索结果原型，归 `features/search/deep-search`，不作为另一个 Chat 实现。
- 通用布局、图谱 UI 和原有静态引用标记位于 `components/common`，基础组件仍在 `components/ui`。
- `types/ai-search.ts` 是首页/Search/Chat 共用后端契约；Chat 视图类型在 `features/chat/types.ts`。

## API

JSON 使用 `{code: 0, data: ...}` 或 `{code, message}`；错误同时使用适当 HTTP 状态码。

| 方法 | 路径（前缀 `/api/v1`） | 职责 |
| --- | --- | --- |
| GET | `/chat/config` | 已配置模型、回答模式、附件限制；不含 Key |
| POST | `/search/explore` | 保留 dev 论文检索 |
| GET / POST | `/chat/sessions` | 列表 / 创建会话及首轮消息 |
| POST | `/chat/anonymous-claim` | 登录后将当前浏览器已完成匿名会话归入账号（仅专用 BFF） |
| GET / PATCH / DELETE | `/chat/sessions/{id}` | 详情 / 标题与收藏 / 删除 |
| POST | `/chat/sessions/{id}/messages` | 续问（服务端构造多轮上下文） |
| GET | `/chat/messages/{id}/stream` | SSE，可携带 `Last-Event-ID` |
| POST | `/chat/messages/{id}/stop` | 取消生成和上游连接 |
| POST | `/chat/messages/{id}/resume` | 继续最近一条停止/失败的回答 |
| POST / GET | `/uploads` / `/uploads/{id}` | 内存解析上传 / 状态 |

### 匿名会话归属切换

- 浏览器只向同源 `POST /api/chat/anonymous-claim` 发送空 POST，不传用户 ID、匿名 ID 或 owner。
- 专用 Next.js Route 从 Better Auth Session 读取目标用户，并从 `shenzhi-chat-anon` HttpOnly Cookie 读取来源匿名 UUID；普通 `/api/v1` 转发仍只注入一个主身份。
- FastAPI 专用端点只接受 BFF 注入的 `X-ShenZhi-User-Id` 与 `X-ShenZhi-Source-Anonymous-Id`，请求体不能指定来源或目标。
- PostgreSQL 在一个事务中只更新没有 `streaming` 消息的 Session owner；Session ID 和 Message 行保持不变。重复或多标签并发调用不会复制数据。
- streaming Session 保持匿名归属；生成完成后刷新页面可再次安全认领。内存模式返回 `durable=false`，不宣称已完成持久化切换。
- Chat Coordinator 在当前页面的登录 Session 稳定后对该用户尝试一次；只有 `durable=true` 且 `moved_count>0` 时才清空旧选择并刷新历史。失败不会影响登录和 Chat，页面重载可重试。

创建入参：`{type, question, mode, model, web_search, attachments}`。问题 1–2000 字，`mode` 为 `fast/deep/idea/doubt`，附件最多 5 个。文件引用为 `{kind:"file", file_id, title}`；正文仅在 Backend 保存与注入。续问可省略模型/模式/联网参数以继承会话设置。

## 唯一 SSE 协议

```text
id: 12
event: delta
data: {"text":"正文增量","reasoning":"可选推理增量"}
```

事件以空行结束，UTF-8 编码。

| 事件 | 主要字段 | 语义 |
| --- | --- | --- |
| `meta` | `phase`, `read_count`, `ephemeral`, `warnings`, `context_truncated` | 阶段/来源数/临时存储/非致命告警 |
| `delta` | `text?`, `reasoning?` | 增量追加，不是全文替换 |
| `refs` | `references[]` | 有 ordinal 的来源快照；空数组不显示假引用 |
| `followups` | `items[]` | 模型生成追问；失败可为空，不影响答案 |
| `error` | `code:number`, `message` | 致命错误，UI 标记失败 |
| `done` | `duration_ms`, `status` | 终止状态 `done/stopped/failed` |

正常：`meta → refs → meta → delta* → followups → done`。失败：`error → done(failed)`。间歇发送 SSE 注释 heartbeat。
上游 `content` / `reasoning_content` 在 FastAPI 转换为 `delta`；Web 没有 A/B 模式或 `token/sources/thinking` 分支。

重连只重放已有事件，不重复调用模型。续写保留同一消息 ID / 正文 / 推理 / 引用序号，返回 `last_event_id`；Client 用此游标只读新增事件。续写通过模型的继续提示实现，不承诺供应商字节级恢复。最后一个流订阅断开、用户 Stop 或应用退出都会取消模型 I/O。当前只允许续写会话最近一轮。

## Provider 配置

复制 `apps/backend/.env.example` 为 `.env`，用 `uvicorn app.main:app --env-file .env` 显式加载。

- 有 `DASHSCOPE_API_KEY` 时使用 DashScope 的 URL / 默认模型；否则使用 `DEEPSEEK_*`。两套配置不交叉拼接。
- `DASHSCOPE_MODEL` 默认 `qwen-plus`；`DEEPSEEK_MODEL` 默认 `deepseek-chat`。
- `AI_ALLOWED_MODELS` 是同一选定 Provider 的额外模型白名单，默认模型自动加入。UI 读取 `/chat/config`，不能任意请求未配置模型。
- 普通模型 `max_tokens=4096`，temperature 按回答模式为 0.3 / 0.6 / 1.0 / 0.85。
- `reasoner/r1/qwen3` 模型 `max_tokens=8192`，不传 temperature。
- `AI_TIMEOUT_SEC` 默认 90 秒（连接超时 10 秒）；追问请求最多 10 秒。401/403/429、超时、异常流和提前 EOF 都标准化处理，不向前端返回密钥或原始供应商错误体。
- 未配置 Key 明确报错，正式代码没有模拟回复。付费 Provider 的实际可用性需要部署环境另行联调。

Web 仅配置 `BUSINESS_BACKEND_URL` 和 `BACKEND_BFF_SECRET`。模型/搜索 Key 禁止写入 Web 或任何 `NEXT_PUBLIC_*`。

## 检索与联网搜索

- `RETRIEVAL_API_URL` 指向 dev 原有 `/api/retrieval/search`；空值禁用论文检索，不偷偷调用硬编码地址。
- `TAVILY_API_KEY` 优先；失败或无结果后使用 `SEARXNG_BASE_URL` 的 JSON `/search`。
- 每个搜索请求 10 秒超时，归一化标题、URL、摘要、引擎、发布日期，并过滤非 HTTP(S) 来源。
- 新闻/近期问题使用 Tavily `news`（week），概念问题使用 `general`（不机械限制一个月）。
- 全部不可用时继续模型回答，但 `meta.warnings` 明确告知未使用互联网实时资料；不能伪造来源。

## 附件

仅 PDF（文字版、未加密）、UTF-8 TXT、MD/Markdown。20MB/份、最多 5 份。
自定义受限 multipart reader 不使用磁盘临时文件，PDF 用 `pypdf` 在内存解析，CPU 解析在线程池执行。
单附件最多 30,000 字、多附件拼接最多 60,000 字；上传返回截断 warning，Chat 再显示合计截断 warning。空文档、坏 PDF、加密 PDF、不支持类型都明确失败。
不支持 DOCX、OCR、图片、Excel。既有知识库/项目选择器仅传条目名称，会显示“未接入全文”告警；没有声称已读取全文。

## 临时 Session 与 Auth

- `MemorySessionRepository`：单进程 / **一个 worker**；最多 500 会话、500 已解析附件、每会话 100 轮；24 小时过期，访问列表/创建时惰性清理。未配置 `CHAT_DATABASE_URL` 时使用；重启丢失，API 返回 `ephemeral: true`。
- 配置 `CHAT_DATABASE_URL` 后启用 PostgreSQL 持久化（见 `PERSISTENCE-PLAN.md`）：会话与消息跨重启保留，`ephemeral: false`；流式生成仍绑定单 worker 进程内缓存。迁移：`cd apps/backend && uv run alembic -c alembic.ini upgrade head`。
- BFF 继续使用 dev 的 Better Auth 获取用户身份；不改登录、注册、邮箱验证、OAuth、PostgreSQL schema。
- BFF 清除浏览器伪造的用户/内部凭据头，再注入经 Better Auth 验证的用户 ID。匿名请求使用 HttpOnly、SameSite=Lax 随机会话 cookie，不按 IP 共用数据。
- 所有会话/消息/上传操作校验临时 owner。不同用户、匿名与登录后数据不自动迁移，过期附件需要重传。
- Backend 不读取 Better Auth 数据库，不引入 B 的 ORM/用户系统。
- 未配置 `BACKEND_BFF_SECRET` 时 Web 与 Backend 均默认拒绝。仅 loopback 本地开发可在两端显式设置 `BACKEND_ALLOW_INSECURE_LOCAL_BFF=true`；非 loopback 部署必须设置同一高熵 Secret，并只允许 BFF 访问 FastAPI。现有 infra/CI 不自动部署新后端。
- Better Auth 正常返回空 Session 时 BFF 按匿名会话转发；Better Auth 调用抛错时 BFF 返回 503，不会静默降级为匿名用户。

### 浏览器降级缓存（local-history）

正式会话仍由 FastAPI `MemorySessionRepository` 管理。仅当 **尚未获得后端 `session_id`**（例如 Backend 未启动、BFF 503、首轮建会话失败）时，Web 才将当前对话写入 `localStorage`（`features/chat/services/local-history.ts`）：

- 最多 30 条、24 小时惰性过期；按浏览器隔离，不与 Better Auth 用户绑定。
- 一旦后端返回 `session_id`，**不再**写入本地缓存，并清除已晋升的本地条目；侧栏以 `/chat/sessions` 列表为准。
- 侧栏合并展示时，本地条目标记为「本地」，不可收藏/重命名；成功接入后端后不应出现同一会话的双条目。

**后续边界**：PostgreSQL 持久化、与 Better Auth 用户关联及匿名会话归属策略、跨 worker 分发、共享链接/权限/保留期限、限流与成本配额。这次没有设计或执行数据库 migration，没有迁移 B 的 `SharedSession` 数据库和公共分享功能。持久化实现方案见 `PERSISTENCE-PLAN.md`。
