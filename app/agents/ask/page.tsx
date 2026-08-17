import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AgentChat } from "@/components/features/agent/agent-chat";

/**
 * AI 助手跳转接收页 `/agents/ask`
 *
 * 这是 A 模块首页选「问 AI」时统一跳转的入口路由，由 A 模块约定提供：
 *   query.q            —— 用户提问内容（URL 编码）
 *   query.mode         —— 回复风格：fast | deep | inspire | question
 *   query.model        —— 模型 ID：default | 具体模型字符串
 *   query.web_search   —— 是否联网："1" 开启 | "0" 关闭
 *
 * 渲染逻辑与 `/agents` 完全相同（同一个 AgentChat 组件），
 * 只是 B 侧在 AgentChat 内部会读取这些 query 参数，
 * 自动填充 Composer 的 style / model / webSearch 共享状态，并发起首次提问。
 *
 * 构建约束：
 *  - AgentChat 内部使用 useSearchParams（客户端 hook），必须包一层 Suspense。
 *  - 该页完全依赖客户端状态（URL query / sessionStorage / store），不做 SSR。
 */
export const dynamic = "force-dynamic";

export default function AgentsAskPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="p-8 text-sm text-muted-foreground">
            正在加载 AI 对话…
          </div>
        }
      >
        <AgentChat />
      </Suspense>
    </AppShell>
  );
}

