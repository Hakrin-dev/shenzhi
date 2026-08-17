import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AgentChat } from "@/components/features/agent/agent-chat";

/**
 * AI 助手页 `/agents` —— 类似网页版 ChatGPT 的对话界面
 *
 * AgentChat 内部使用 useSearchParams（解析 URL query 同步 Composer 状态），
 * 所以包一层 Suspense + 强制动态渲染，避免 Next.js 生产构建报
 * "useSearchParams() should be wrapped in a suspense boundary"。
 */
export const dynamic = "force-dynamic";

export default function AgentsPage() {
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
