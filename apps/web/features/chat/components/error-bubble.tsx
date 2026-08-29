"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

function hintForError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("401") || lower.includes("403") || lower.includes("密钥")) {
    return { title: "模型服务未就绪", action: "请检查后端 .env 中的 API Key 配置。" };
  }
  if (lower.includes("429") || lower.includes("限流")) {
    return { title: "请求过于频繁", action: "请稍后再试，或切换模型。" };
  }
  if (lower.includes("timeout") || lower.includes("超时")) {
    return { title: "生成超时", action: "可点击「继续生成」重试，或缩短问题后重发。" };
  }
  return { title: "生成失败", action: "可重试或更换模型后再试。" };
}

/** Agent B 风格错误气泡 */
export function ErrorBubble({
  message,
  onResume,
  canResume,
}: {
  message: string;
  onResume: () => void;
  canResume: boolean;
}) {
  const hint = hintForError(message);
  return (
    <div className="rounded-2xl rounded-tl-md border border-red-200/70 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/30">
      <div className="mb-2 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-red-800 dark:text-red-200">{hint.title}</p>
          <p className="mt-1 break-all text-[12px] text-red-700/90 dark:text-red-300/90">{message}</p>
          {hint.action && (
            <p className="mt-2 rounded-lg bg-white/70 p-2 text-[12px] leading-relaxed text-red-900/90 dark:bg-black/20 dark:text-red-100/90">
              {hint.action}
            </p>
          )}
        </div>
      </div>
      {canResume && (
        <button
          type="button"
          onClick={onResume}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/80 px-3 py-1.5 text-[12px] font-medium text-red-800 shadow-sm ring-1 ring-red-200/80 hover:bg-white dark:bg-red-950/50 dark:text-red-100 dark:ring-red-900/50"
        >
          <RotateCcw className="size-3.5" />
          继续生成
        </button>
      )}
    </div>
  );
}
