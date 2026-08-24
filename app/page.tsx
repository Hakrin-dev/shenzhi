import { redirect } from "next/navigation";

/**
 * 首页 —— 重定向到 AI 助手页（当前核心功能）
 * 原首页为"发现"页（搜索 + 信息流），已在精简中移除。
 */
export default function HomePage() {
  redirect("/agents/ask");
}
