# ShenZhi B 模块开发改动报告

> 报告对象：B 模块（AI 对话与模型能力）—— 全部代码改动完整记录
> 仓库：`https://github.com/Hakrin-dev/shenzhi`
> 本地路径：`c:\Users\18237\Desktop\深知原型\shenzhi`
> 开发分工：A（搜索入口）/ B（AI 对话与模型能力）/ C（附件、联网、来源）
> 本报告负责人：B 模块
> 报告日期：2026-08-16

---

## 一、总览：改动统计

本次开发一共涉及 **9 个文件**，其中 **6 个新建、3 个修改**，净新增约 **1,150 行代码**。

| 类型 | 文件 | 行数（约） | 说明 |
|---|---|---|---|
| 新建 | `lib/request.ts` | 172 | 全局请求封装 + ngrok 拦截处理 |
| 新建 | `lib/chat-prompt.ts` | 70 | 4 种回复风格 System Prompt + 上下文拼接 |
| 新建 | `lib/chat-stream.ts` | 184 | 前端流式对话 Hook |
| 新建 | `stores/composer.ts` | 94 | A/B/C 共享状态总线（Zustand） |
| 新建 | `app/api/ai/chat/route.ts` | 311 | 后端统一 AI 对话接口（SSE） |
| 新建 | `app/agents/ask/page.tsx` | 22 | A 模块跳转接收路由 |
| 修改 | `types/index.ts` | +109 | 追加三人联调统一类型契约 |
| 修改 | `components/features/agent/composer.tsx` | +428 | 重写，接入共享状态与完整 UI |
| 修改 | `components/features/agent/agent-chat.tsx` | +658/-156 | 重写，流式对话核心页面 |

---

## 二、时间线回顾

| 阶段 | 工作内容 |
|---|---|
| 阶段 0 | 环境搭建：clone 仓库、安装 pnpm、安装依赖、启动 dev server |
| 阶段 1 | 需求对齐：在 `types/index.ts` 落地三人统一 ChatRequest 契约 |
| 阶段 2 | lib 层：新建 `request.ts` / `chat-prompt.ts` / `chat-stream.ts` |
| 阶段 3 | 共享状态：新建 `stores/composer.ts`，重写 `composer.tsx` |
| 阶段 4 | 后端 + 页面：新建 `route.ts`，重写 `agent-chat.tsx` |
| 阶段 5 | A+B 联调适配：新建 `app/agents/ask/page.tsx`，解析 A 传参 |
| 阶段 6 | 质量检查：`tsc --noEmit` + `eslint` 修复至 0 error / 0 warning |

---

## 三、阶段 0：环境搭建（操作记录，无代码改动）

1. 将远程仓库 clone 到本机：
   ```bash
   git clone https://github.com/Hakrin-dev/shenzhi "c:\Users\18237\Desktop\深知原型\shenzhi"
   ```
2. 安装包管理器 pnpm（本机原先未安装）：
   ```bash
   npm install -g pnpm@11
   ```
3. 安装项目依赖：
   ```bash
   pnpm install
   ```
4. 启动本地开发服务器：
   ```bash
   pnpm dev        # http://localhost:3000
   ```

> 项目技术栈：Next.js 16（App Router）+ React 19 + TypeScript + Zustand + SSE 流式。

---

## 四、新建文件详细说明

### 4.1 `lib/request.ts`（新建，172 行）

**用途**：B 模块的全局请求封装，解决「ngrok 免费版拦截 AI 请求」这一联调阻塞问题。

**关键实现**：

- 常量 `DEFAULT_HEADERS`：所有请求自动携带 `ngrok-skip-browser-warning: true`。
- `shenzhiFetch<T>()`：普通 JSON 请求封装，自动注入 header，并对返回内容做 HTML 拦截检测。
- `fetchSSE()`：SSE 流式请求封装（供 AI 对话使用），返回异步可迭代的事件流 + `stop()` 中断句柄。
- 自定义错误 `NgrokInterceptError`：当响应是 ngrok 警告页 HTML 或 403 时抛出，供前端展示分类错误提示。

```typescript
const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};
```

---

### 4.2 `lib/chat-prompt.ts`（新建，70 行）

**用途**：4 种回复风格的 System Prompt 与模型消息拼接。

**关键导出**：

- `STYLE_PROMPTS`：`fast` / `deep` / `inspire` / `question` 四种风格的 System Prompt 文案（通过 System Prompt 区分风格，不更换模型）。
- `buildModelMessages()`：把「风格 System Prompt + 多轮历史 + 附件文本 + 联网搜索结果」拼成最终送给模型的 `messages` 数组，实现附件问答与联网上下文注入。

---

### 4.3 `lib/chat-stream.ts`（新建，184 行）

**用途**：前端调用 `/api/ai/chat` 的统一 React Hook。

**关键导出**：

- `useChatStream(getCbs)`：入参为 **getter 函数**（`() => cbsRef.current`），返回 `{ stop, retry }`。
  - 内部通过 `fetchSSE` 建立流式连接，逐 token 回调 `onToken`。
  - 60 秒无首 token 判定超时，触发 `TIMEOUT` 错误。
  - 捕获 `NgrokInterceptError` / 403 / 限流等错误并归一化错误码。
  - 联网开启时，先调用 C 模块的 `webSearchFn` 拿搜索结果，再注入 prompt。

> 设计要点：入参用 getter 而非对象字面量，是为了规避 React Compiler 的「render 期间读取 ref.current」严格检查，同时保证回调始终拿到最新值。

---

### 4.4 `stores/composer.ts`（新建，94 行）

**用途**：A / B / C 三模块共享状态的「总线」（Zustand store）。

**共享状态**：

| 状态 | 类型 | 说明 |
|---|---|---|
| `mode` | `ChatMode` | A 维护：search / ai |
| `message` | `string` | 当前输入 |
| `model` | `string` | 选中的模型 ID |
| `style` | `ChatStyle` | 回复风格 |
| `webSearch` | `boolean` | C 维护：联网开关 |
| `attachments` | `ChatAttachment[]` | C 维护：附件解析列表 |
| `webSearchFn` | `(q) => Promise<ChatSource[]>` | C 挂载的联网搜索函数 |

**关键 action**：`setMode` / `setMessage` / `setModel` / `setStyle` / `setWebSearch` / `addAttachment` / `removeAttachment` / `updateAttachment` / `setWebSearchFn` / `resetDraft`。

---

### 4.5 `app/api/ai/chat/route.ts`（新建，311 行）

**用途**：后端统一 AI 对话接口，`POST /api/ai/chat`，全项目 AI 请求唯一出口（禁止组件直连厂商 API）。

**关键实现**：

- 入参校验：严格按 `ChatRequest` 结构体解析，字段缺失返回 `SCHEMA_ERROR`。
- SSE 事件协议：`sources → token（多次）→ done | error`。
- `STYLE_REPLY_TEMPLATES`：4 种风格的模拟回复模板（当前为原型模拟，接入真实模型时只需替换 `createModelStream()` 内部调用）。
- `mockWebSources()`：模拟联网搜索来源（C 模块接入后替换为真实）。
- 错误也通过 SSE `error` 事件返回，而非 500 断连，保证前端有提示。

---

### 4.6 `app/agents/ask/page.tsx`（新建，22 行）

**用途**：A 模块首页「问 AI」的跳转接收路由。

**背景**：A 同学提供的联调链接是 `/agents/ask?q=...&mode=...&model=...&web_search=...`，但项目原本只有 `/agents` 路由，会 404。此文件补上 `/agents/ask` 路径，渲染与 `/agents` 完全相同的 `AgentChat` 组件。

---

## 五、修改文件详细说明

### 5.1 `types/index.ts`（修改，末尾追加 +109 行）

在原文件末尾追加「B 模块三人联调统一契约」区块，新增以下类型：

| 类型 | 作用 |
|---|---|
| `ChatMode` | `"search" \| "ai"` |
| `ChatStyle` | `"fast" \| "deep" \| "inspire" \| "question"` |
| `ChatMessageRole` / `ChatMessage` | 对话消息 |
| `ChatAttachment` | 附件解析结果（C 维护） |
| `ChatSource` | 来源引用（B 透传 C 渲染） |
| `ChatRequest` | **核心契约**，7 字段：`mode/message/model/style/webSearch/attachments/messages` |
| `ChatStreamEventType` / `ChatStreamEvent` | SSE 事件协议 |
| `ChatSessionStatus` / `ChatUIMessage` | 前端 UI 状态 |

> 其中 `ChatSource` 在联调期间追加了 `type?` 和 `snippet?` 两个可选字段，用于来源类型与搜索摘要展示。

---

### 5.2 `components/features/agent/composer.tsx`（修改，重写 +428 行）

**改动内容**：

1. 从本地 useState 改为读取 `useComposerStore` 共享状态。
2. 增加 4 种回复风格切换（快速/深度/灵感/质疑）。
3. 增加联网搜索开关（映射 `webSearch`）。
4. 增加附件上传芯片（PDF / TXT / Markdown），解析后写入 `store.attachments`。
5. 增加流式状态下的「停止生成」按钮（`isStreaming` 时发送按钮变停止）。

---

### 5.3 `components/features/agent/agent-chat.tsx`（修改，重写 +658/-156）

**改动内容（B 模块核心页面）**：

1. **路由参数读取**：从 `/agents` 或 `/agents/ask` 读取 `q/message/query` 作为初始提问。
2. **A 传参解析**：读取 `?mode` → 写 `style`、`?model` → 写 `model`、`?web_search`（"1"/"0"）→ 写 `webSearch`。
3. **多轮上下文记忆**：`messages` 数组 + `messagesRef` 同步持久化。
4. **流式渲染**：逐 token 追加到 assistant 消息，附光标动画。
5. **Stop 停止**：中断 SSE，占位消息标记为 `stopped`。
6. **Retry 重试**：复用最后一条 user 提问重新发起。
7. **错误 UI `ErrorBubble`**：按 7 种错误码（`NGROK_INTERCEPT` / `NGROK_403` / `TIMEOUT` / `RATE_LIMITED` / `SCHEMA_ERROR` / `INVALID_JSON` / `MODEL_CRASH`）给出带修复步骤的中文提示。
8. **`SourcesSection`**：AI 返回 `sources` 后透传渲染引用卡片（占位实现，后续替换 C 的 `ReferenceGrid`）。
9. **`doSend()`**：独立的流式请求函数，联网时前置调用 `webSearchFn`，构造 `ChatRequest` 后走 `fetchSSE`。

---

## 六、质量检查与修复记录

开发过程中 `tsc --noEmit` 与 `eslint` 暴露并修复的问题如下：

| 问题 | 位置 | 修复方式 |
|---|---|---|
| 全角引号 `"` 破坏 TS 字符串语法 | `lib/chat-prompt.ts` | 替换为直角引号 `『』` |
| `ChatSource` 重复导入 | `agent-chat.tsx` | 删除底部重复 import |
| `ChatSource` 缺 `type/snippet` 字段 | `types/index.ts` | 追加可选字段 |
| `sendInternal` 先访问后声明 | `agent-chat.tsx` | 重排 effect 顺序 |
| render 期间读写 ref.current | `agent-chat.tsx` / `chat-stream.ts` | 改为 ref + useEffect 同步 |
| React Compiler「manual memoization 无法保留」 | `agent-chat.tsx` | 用 ref 存回调，避免 useMemo 对象成员依赖 |
| React 19 StrictMode 双调用导致自动发起失效 | `agent-chat.tsx` | cleanup 中复位 `autoLaunchedRef` |

最终状态：**`tsc --noEmit` 0 error；B 模块目录 ESLint 0 error / 0 warning**。

> 注：`app/settings`、`app/deep-research`、`theme-toggle` 等文件存在 A/C 模块原有 lint error，按协作边界未越界修改。

---

## 七、联调验证结果（浏览器实测通过）

| 用例 | 结果 |
|---|---|
| `fast` + `web_search=0` | ✅ 快速模式 + 自动填充 + 流式回答 + 联网已关闭 |
| 多轮追问 | ✅ 第 2 轮提问成功回答（上下文记忆） |
| `deep` + `web_search=1` | ✅ 深度模式长文 + 联网已开启 + 来源引用 4 张卡片渲染 |
| `mode` / `model` / `web_search` 解析 | ✅ 正确写入 Composer 共享状态 |

---

## 八、与 A / C 模块的协作边界（本文档相关）

- **A → B**：A 通过路由跳转 `/agents/ask?q=...&mode=...&model=...&web_search=...` 传参，B 读取并自动发起。
- **B ↔ C**：通过 `stores/composer.ts` 共享 `webSearch` / `attachments` / `webSearchFn`；B 把 `sources` 透传给 C 渲染。
- **三人统一契约**：`types/index.ts` 中 `ChatRequest` 结构体，字段命名严格一致，B 主导维护。

---

## 九、遗留事项 / 待办

1. 后端 `/api/ai/chat` 目前为**模拟流式回复**，接入真实大模型时只需替换 `createModelStream()` 内部调用。
2. `SourcesSection` 为占位实现，需在联调阶段替换为 C 同学的 `ReferenceGrid` 组件。
3. C 模块接入后，`webSearchFn` 与真实联网搜索、附件 PDF 解析需挂载到 `stores/composer.ts`。
4. A 同学需同步本次代码并重启其 ngrok 指向的 dev server，否则 `/agents/ask` 路由仍会 404。
