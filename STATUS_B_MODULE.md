# 深知 ShenZhi · B 模块代码状态说明（AI 助手 / 模型能力）

> 最后更新：2026-08-17 | 状态：✅ 可本地独立验收 + 已接入 DeepSeek 真实模型
> 代码目录：`shenzhi/`（本文档所在目录）
> 配套 A 模块（首页 / 搜索 / Deep Research）：`../shenzhi-feat-ai_agent_front/shenzhi-feat-ai_agent_front/`

---

## 一、本模块定位与职责

根据团队《AI 助手开发分工》文档，B 模块负责**模型侧能力**，与 A（搜索交互入口 / Deep Research）、C（知识库 / 真实联网搜索前置）形成三方协作。当前 B 模块已具备独立运行能力，并提供可嵌入 A 前端页面的「AI 助手」子路由。

B 模块的交付物 = **UI 层（聊天 / 思考面板 / 附件） + 服务端 API（`/api/ai/chat` SSE 流式）+ 类型契约 + 状态管理**，任何改动都不能破坏与 A 模块已对齐的参数约定。

---

## 二、当前实现的功能清单

### 2.1 AI 对话核心（已具备）
| 功能 | 状态 | 说明 |
|------|------|------|
| ✅ SSE 流式逐 token 渲染 | 已验收 | `/api/ai/chat` 返回 `text/event-stream`，前端 `useAskSession` hook 边收边渲染 |
| ✅ 4 档回复风格 | 已验收 | `fast / deep / idea / doubt`，通过 `STYLE_PROMPTS[style]`（System Prompt）+ `temperature` 共同控制 |
| ✅ 多轮上下文传递 | 已验收 | 前端 `body.messages` 按顺序拼成 system + history + user，整包传给模型 |
| ✅ 模型选择（前端下拉 + 后端回退） | 已验收 | `deepseek-chat` / `deepseek-reasoner`；A 协议三档常量 `default / subscription / byok` 回落到 env 默认模型 |
| ✅ 停止生成（Stop） | 已验收 | 点击按钮触发 `AbortController.abort()`，同步取消 DeepSeek fetch，避免继续烧 token |
| ✅ 错误提示（错误码 → 用户友好文案） | 已具备 | `AI_ERROR_HINTS` 覆盖：Key 缺失 / 限流 / 401 / 429 / 网络中断 / schema 校验失败 |
| ✅ Follow-Ups 追问建议 | 已合成 | B 后端（C 未接入时）自动合成 3 条，如「要点总结 / 概念对比 / 入门路径」 |
| ✅ 参考来源卡片（sources 事件） | 已具备 UI | 当前 C 模块未接入时不发；以后接入只要前端 `webSearchFn` 返回或后端注入即可渲染 |
| ✅ 附件上传 / 引用（ChatAttachment 契约） | 已具备结构 | A → B 通过 sessionStorage draft 互转 |

### 2.2 双后端适配层（B 模块 = 可切换模式）
为了兼顾「用真实模型独立开发」和「以后接 A 同学后端」两种场景，所有模型调用都走统一适配层 `lib/api/search.ts`：

- **`NEXT_PUBLIC_AI_BACKEND_MODE=B`（默认，当前推荐）**
  - 请求 → 本项目 B 服务端 `/api/ai/chat` → 直连 DeepSeek / 任何 OpenAI 兼容厂商
  - 不依赖 ngrok，本地离线（除了模型 API 本身）即可跑通

- **`NEXT_PUBLIC_AI_BACKEND_MODE=A`（保留待用）**
  - 请求 → `/api/v1/*` 代理 → `API_URL`（A 同学后端或 ngrok 地址）
  - 遵循 A 后端两步法协议：`POST /chat/sessions (创建会话) → POST /chat/sessions/{id}/messages:stream（流式）`
  - 目前 ngrok 链路已弃用，保留代码仅便于后续 A 后端部署后切换

### 2.3 真实模型接入（当前使用 DeepSeek）
替换了原先的 mock 文本生成器，`app/api/ai/chat/route.ts` 内部 `createModelStream()`：
1. 从服务端环境变量读取 `DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL`（**全部无 NEXT_PUBLIC_ 前缀，永不进前端**）
2. `fetch → POST /chat/completions (stream=true, temperature=按风格, max_tokens=4096)`
3. `streamDeepSeekChunks()` 把 OpenAI 兼容 SSE 的 `data: {...}\n\n` 拆成逐 token yield
4. 非 2xx 响应进入 `extractDeepSeekError()`，结构化提取 `{ code, message }` → 通过标准 `error` SSE 事件返前端，绝不直接 500 断开

OpenAI 兼容厂商切换：只要改 `.env.local` 的 `DEEPSEEK_BASE_URL` + `DEEPSEEK_API_KEY` 即可，代码零改动。

---

## 三、已验收通过项（2026-08-17 实测）

### 3.1 DeepSeek API 连通性（独立脚本 3/3）
脚本：`test_deepseek_connectivity.mjs`（Node.js 直接执行，不依赖 Next.js）

| 项 | 实测结果 |
|----|----------|
| 非流式 `chat/completions` | HTTP 200 · 202ms · 26 tokens · 回复正确 |
| 流式 SSE | HTTP 200 · TTFB 126ms · 首 token 415ms · 30 tokens |
| 错误鉴权解析 | HTTP 401 · 正确解析 `invalid_request_error` 结构 |

### 3.2 B 模块端到端（浏览器）
- 页面：`http://localhost:3000/agents/ask?q=视觉&mode=fast&model=default&web_search=0`
- 行为：URL 参数自动读入输入框 → 自动 send → 流式渲染 → Follow-Ups 按钮出现
- **后端实锤日志：**
  ```
  [DeepSeek] → https://api.deepseek.com/v1/chat/completions
               model=deepseek-chat | t=0.3 | messages=123
  [DeepSeek] ✅ 生成结束 | 输出字符=90
  POST /api/ai/chat 200 in 1080ms
  ```

---

## 四、已知情况 / 注意事项（非 Bug，提交前须明确）

| # | 现象 | 范围 | 是否影响功能 | 说明 / 解决方式 |
|---|------|------|--------------|-----------------|
| 1 | **开发环境下 AI 回复卡片出现多条重复** | 仅 `pnpm dev`（StrictMode） | ❌ 不影响（生产构建无） | React 19 StrictMode 开发模式会双调用 `useEffect → send`，导致前 N-1 次被 abort（浏览器 network 里可见 ERR_ABORTED），最后 1 次成功。执行 `pnpm build && pnpm start` 后自动消失 |
| 2 | **ngrok 免费版链路已废弃** | 仅 A 模式 | ❌ 不影响（当前用 B 模式） | 原 ngrok 地址会过期 + 注入警告 HTML，当前建议保持 `NEXT_PUBLIC_AI_BACKEND_MODE=B` |
| 3 | **真实联网搜索 / 参考来源卡片暂为空** | 所有模式 | ⚠️ 待 C 模块接入 | 目前 B 后端的 `createModelStream` 不主动触发联网搜索；前端 UI 已预留 `sources` 渲染，等 C 模块就绪后把 `webSearchSources` 注入即可 |
| 4 | **A 协议三档模型常量（default / subscription / byok）不对应真实模型名** | 仅 A→B 参数过渡 | ❌ 不影响 | `resolveModel()` 会把这三档统一回落到 `.env.local` 的 `DEEPSEEK_MODEL` |
| 5 | **测试脚本依赖 Node 18+（global fetch）** | 仅本地验证工具 | ❌ 不影响（项目 pnpm dev 也要求 Node 18+） | Node 16 及以下建议升级 |

---

## 五、A 模块（本地）+ B 模块（本地）双前端协作模式

**放弃 A 同学的 ngrok 后，采用双前端并行方案：**

| 模块 | 端口 | 角色 | 启动命令 |
|------|------|------|----------|
| A 前端（入口） | **3001** | 首页 / 搜索 / Deep Research；用户点击「AI 助手」跳 B 的 3000 | `cd ../shenzhi-feat-ai_agent_front/shenzhi-feat-ai_agent_front && pnpm dev -- --port 3001` |
| B 前端 + AI 后端 | **3000** | `/agents/ask` 对话页；`/api/ai/chat` 直连真实模型 | `cd shenzhi && pnpm dev -- --port 3000` |

**跳转契约（已在 B 侧实现）：**
```
A 点击「AI 助手」→ 浏览器打开：
http://localhost:3000/agents/ask?q=<搜索词>&mode=<fast|deep|idea|doubt>&model=<default|...>&web_search=<0|1>
```

B 侧 `components/features/agent/agent-chat.tsx` 处理：
1. `useSearchParams` 读 `q / mode / model / web_search` → 同步到 Zustand `useComposerStore`
2. 同时尝试 `sessionStorage` 读 draft（含附件 `ChatAttachment[]`）→ 恢复输入框与附件
3. 满足条件时自动触发 `sendInternal()`，用户无需二次回车

---

## 六、从零启动 / 验收完整步骤（对拿到代码的同学）

### 6.1 前置条件
- Node.js ≥ 18（推荐 20 LTS；当前开发机为 Node 24.19.0，通过）
- pnpm ≥ 9（仓库用 pnpm workspace）
- 一个 DeepSeek API Key：从 https://platform.deepseek.com/api_keys 获取（免费额度够做大量开发测试）

### 6.2 一键跑通 B 模块（最小路径）
```bash
cd shenzhi

# 1. 安装依赖（首次需要，后续跳过）
pnpm install

# 2. 配置凭据 —— 只做这一次，Key 绝对不要提交 Git
cp .env.example .env.local
# 然后用编辑器打开 .env.local，把 DEEPSEEK_API_KEY 改成你的真实 sk- 开头值

# 3. 先做连通性测试（保证 Key / 网络 / 厂商端点正确，再启动前端）
node test_deepseek_connectivity.mjs
# ✅ 期望输出：总计 3 项 通过 3/3

# 4. 启动 Next.js 开发服务
pnpm dev -- --port 3000

# 5. 浏览器验证端到端（会自动发第一条提问「视觉」）
# 打开：http://localhost:3000/agents/ask?q=%E8%A7%86%E8%A7%89&mode=fast&model=default&web_search=0
# 验收点：流式输出 + 停止按钮可用 + Follow-Ups 追问按钮渲染
```

### 6.3 切换到 A 模式（以后 A 后端本地跑起来后）
```bash
# 编辑 .env.local：
# NEXT_PUBLIC_AI_BACKEND_MODE=A
# API_URL=http://127.0.0.1:你的A后端端口
# NEXT_PUBLIC_API_URL=http://127.0.0.1:你的A后端端口

# 重启 Next.js（环境变量只在启动时读取一次）
# 然后请求会自动走 /api/v1/* 代理到 A 后端
```

### 6.4 生产构建（消除 StrictMode 重复卡片，最终交付用）
```bash
cd shenzhi
pnpm build      # 产出 .next/ 静态+服务端 bundle；同时也跑 tsc 类型检查
pnpm start -- --port 3000
```

---

## 七、关键文件变更速查（自项目起）

> 原仓库首次 clone 下来后，B 模块共 **新增 6 个 / 修改 3 个** 核心文件（不含一次性验证脚本），合计约 1150 行新代码。另含一份完整变更报告。

| 文件 | 类型 | 作用 |
|------|------|------|
| `types/ai-search.ts` | 新增 | 三方契约统一类型：`ChatRequest / ChatStyle / ChatAttachment / CreateChatSessionResponse / SSE 事件类型` 等 |
| `lib/ask/draft.ts` | 新增 | sessionStorage draft 读写 + A↔B 参数/附件结构互转 |
| `lib/ask/errors.ts` | 新增 | 错误码 → 用户友好文案映射 + `normalizeAIError()` |
| `lib/sse.ts` | 新增 | 通用 `readSSEStream()` 解析器（与 A 模块协议对齐） |
| `lib/api/search.ts` | 新增 | A/B 双后端适配层：两步会话 / 流式 / Stop / 风格映射 |
| `lib/chat-stream.ts` | 新增 | `useAskSession` hook：SSE 生命周期、超时、取消、错误上报 |
| `components/features/agent/agent-chat.tsx` | 大改 | AI 助手聊天 UI：参数解析、思考面板、参考卡片、Follow-Ups、多轮状态 |
| `app/api/ai/chat/route.ts` | 大改 | B 模式核心服务端：直连 DeepSeek 流式（替换原 mock 文本） |
| `app/agents/ask/page.tsx` | 新增+改 | 加 `Suspense` 边界 + `dynamic = "force-dynamic"`，避免 build 期 `useSearchParams` 报错 |
| `B模块开发改动报告.md` | 新增 | 逐文件逐行的详细开发记录（已交付） |
| `test_deepseek_connectivity.mjs` | 新增 | DeepSeek 连通性独立测试脚本（3 项：非流式 / 流式 / 错误解析） |
| `.env.example` | 大改 | 补齐 B 模式+DeepSeek 变量占位与安全红线声明 |
| `.gitignore` | 改 | 补 `tmp_*.mjs / shot_* / browser-logs/` 等临时产物忽略 |

---

## 八、安全策略（提交 GitHub 前必读）

### 8.1 密钥的唯一合法位置
任何真实凭据（`DEEPSEEK_API_KEY`、`AUTH_SECRET`、生产 `API_URL` 内 Token）**只能**出现在本机 `shenzhi/.env.local` 文件中，该文件已被 `.gitignore` 第 26 行的 `.env*` 规则完全忽略，**永远不会被 `git add` 命中**。

本仓库已经做了如下硬防护：
```
.gitignore L25-27：
  .env*        ← 所有 .env .env.local .env.production 全部忽略
  !.env.example ← 唯独放行 .env.example 占位模板（只能放占位符，不能放真实值）
```

### 8.2 开发者自检清单（提交前执行一次）
```bash
cd shenzhi

# ✅ 检查 1：敏感文件是否全被 Git 忽略 → 期望列出 .env.local + tmp_e2e_api.mjs 等
git status --ignored --short

# ✅ 检查 2：全仓库扫描硬编码 Key（sk- 开头 ≥ 20 位）
#   期望：无任何输出（已把 test_deepseek_connectivity.mjs 的兜底删除）
findstr /S /R /I /C:"sk-[0-9a-f][0-9a-f]*" app\* lib\* components\* stores\* types\* *.mjs *.ts *.tsx 2>nul || echo "✅ 无硬编码 Key"
# （类 Unix 用 grep 版本）
# grep -rn --exclude-dir={node_modules,.next,.git} -E 'sk-[0-9a-fA-F]{20,}' .

# ✅ 检查 3：.env.example 是否仍使用占位符
#   DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  ✅ 正确
#   任何地方出现 sk-05c1dd32... 等真实值            ❌ 必须立即回滚
```

### 8.3 如果不小心把 Key 提交了怎么办？
**第一步（立即做，最重要）：** 去 https://platform.deepseek.com/api_keys 把泄漏的 Key **立即吊销并重新生成**。Git 历史即使被 amend 也仍在 reflog / fork 中存在，**吊销是唯一可靠的止损**。

**第二步（补救）：** 用 `git filter-repo` 或 BFG Repo-Cleaner 从历史中擦除；但这只能防「未被人看到的历史」，不能替代第一步的吊销。

---

## 九、下一步可选推进项（优先级从高到低）

1. **启动 A 模块（本地 3001）做完整跨模块联调**：验证搜索词 + 附件 draft 从 A → B 的端到端传递
2. **4 档回复风格人工对比**：在同一提问下切换 fast / deep / idea / doubt，确认输出长度、锐度、发散度确实不同（可截图整理成团队验收材料）
3. **接入 R1 推理模型（`deepseek-reasoner`）**：确认数学 / 逻辑 / 代码提问场景效果明显优于 `deepseek-chat`
4. **对接 C 模块前置联网搜索**：把 `webSearchFn` 返回结果注入 SSE，使「参考来源卡片」真正渲染真实来源
5. **做一次 production build + 静态部署验证**：关闭 StrictMode 后重复卡片自然消失，同时也能暴露 tsc 类型 / next build 打包错误

---

## 十、关键代码参考（便于快速跳读）

- 真实模型调用入口（SSE 流式主循环）：[app/api/ai/chat/route.ts](file:///c:/Users/18237/Desktop/深知原型/shenzhi/app/api/ai/chat/route.ts#L196-L296)
- A/B 双后端适配层：[lib/api/search.ts](file:///c:/Users/18237/Desktop/深知原型/shenzhi/lib/api/search.ts)
- 统一类型契约：[types/ai-search.ts](file:///c:/Users/18237/Desktop/深知原型/shenzhi/types/ai-search.ts)
- 聊天 UI 主组件：[components/features/agent/agent-chat.tsx](file:///c:/Users/18237/Desktop/深知原型/shenzhi/components/features/agent/agent-chat.tsx)
- 环境变量模板（含安全说明）：[.env.example](file:///c:/Users/18237/Desktop/深知原型/shenzhi/.env.example)
- Git 忽略规则（关键安全防线）：[.gitignore](file:///c:/Users/18237/Desktop/深知原型/shenzhi/.gitignore#L25-L43)
- DeepSeek 连通性独立测试脚本：[test_deepseek_connectivity.mjs](file:///c:/Users/18237/Desktop/深知原型/shenzhi/test_deepseek_connectivity.mjs)
