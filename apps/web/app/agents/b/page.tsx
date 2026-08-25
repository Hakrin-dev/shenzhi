import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AgentChatB } from "@/modules/ai-agent-b/pages/AgentChatBPage";
import { QueryProvider } from "@b/providers/query-provider";
import { AuthProvider } from "@b/providers/auth-provider";

export const dynamic = "force-dynamic";

export default function AgentsBPage() {
  return (
    <AppShell>
      <AuthProvider>
        <QueryProvider>
        <Suspense
          fallback={
            <div className="p-8 text-sm text-muted">正在加载 B 模块对话…</div>
          }
        >
          <AgentChatB />
        </Suspense>
        </QueryProvider>
      </AuthProvider>
    </AppShell>
  );
}
