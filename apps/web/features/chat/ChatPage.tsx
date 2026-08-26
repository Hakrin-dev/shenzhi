import { AppShell } from "@/components/common/layout/app-shell";
import { AgentChat } from "@/features/chat/components/agent-chat";

/** AI 助手页 `/agents` —— 类似网页版 ChatGPT 的对话界面 */
export function ChatPage() {
  return (
    <AppShell>
      <AgentChat />
    </AppShell>
  );
}
