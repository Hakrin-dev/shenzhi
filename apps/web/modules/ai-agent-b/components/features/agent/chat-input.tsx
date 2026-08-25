"use client";

/**
 * UPDATE: 2026-08-18 A+B 单前端整合
 *   —— ComposerShell onSend 签名从 `() => void` 升级为 `(payload: ComposerSubmitPayload) => void`，
 *     兼容调用方（search-hero / agent-chat / 此处 ChatInput）三处 TS 签名。
 * 修改日志：任务日志/对于A的修改/2026.8.18-A+B整合单前端化修改.md
 */

import { useState } from "react";
import { ComposerShell } from "./composer";
import type { ComposerSubmitPayload } from "@b/types/ai-search";

/** 底部提问输入框 —— 支持追问 / 上传 PDF / arXiv 链接 */
export function ChatInput() {
  const [value, setValue] = useState("");

  return (
    <div className="sticky bottom-4">
      <ComposerShell
        value={value}
        onChange={setValue}
        onSend={(_payload: ComposerSubmitPayload) => setValue("")}
        placeholder="继续提问,或上传 PDF / arXiv 链接以扩展上下文…"
        menuPlacement="up"
      />
      <p className="mt-2 text-[11px] text-faint">
        支持上传 PDF / arXiv 链接 · 对话可保存到知识库 · 引用 [N] 可点击跳转
      </p>
    </div>
  );
}
