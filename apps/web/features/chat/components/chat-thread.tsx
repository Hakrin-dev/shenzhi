"use client";

import { useState } from "react";
import { Check, Copy, LoaderCircle, RotateCcw } from "lucide-react";
import type { ChatTurn } from "../types";
import { CitationScope } from "./citations";
import { MarkdownContent } from "./markdown-content";
import { ReferenceGrid } from "./reference-grid";

function AssistantTurn({ turn, canResume, busy, onResume, onFollowup }: {
  turn: ChatTurn; canResume: boolean; busy: boolean; onResume: () => void; onFollowup: (question: string) => void;
}) {
  const [copyState, setCopyState] = useState("");
  const streaming = turn.status === "streaming";
  return <CitationScope><div className="space-y-3 text-ink">
    <details className="rounded-xl bg-panel px-3 py-2 text-[13px] text-muted">
      <summary className="cursor-pointer">
        {streaming ? <LoaderCircle className="mr-2 inline size-3.5 animate-spin text-primary" /> : <Check className="mr-2 inline size-3.5" />}
        {streaming ? turn.thought : turn.status === "stopped" ? "已停止" : turn.status === "failed" ? "生成失败" : "生成完成"}
        {turn.readCount !== undefined ? ` · 参考 ${turn.readCount} 项来源` : ""}
        {turn.durationMs !== undefined ? ` · ${(turn.durationMs / 1000).toFixed(1)}s` : ""}
      </summary>
      <p className="mt-2">{turn.thought}</p>
    </details>
    {turn.warnings.map((warning) => <p key={warning} role="status" className="rounded-lg border border-amber-300/40 bg-amber-50/30 px-3 py-2 text-xs text-muted">{warning}</p>)}
    {turn.reasoning && <details className="rounded-xl border border-primary/20 bg-primary-soft/40 px-3 py-2 text-[13px]" open={streaming || undefined}>
      <summary className="cursor-pointer text-primary">深度思考{streaming ? "中…" : ""}</summary>
      <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap leading-6 text-muted">{turn.reasoning}</div>
    </details>}
    {turn.content && <MarkdownContent text={turn.content} />}
    {!turn.content && streaming && <p className="animate-pulse text-sm text-muted">正在思考…</p>}
    {turn.error && <p role="alert" className="rounded-xl border border-line bg-panel px-3 py-2 text-sm text-muted">{turn.error}</p>}
    <ReferenceGrid references={turn.references} />
    <div className="flex gap-3 text-xs text-muted">
      {turn.content && <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => {
        void navigator.clipboard.writeText(turn.content).then(() => setCopyState("已复制"), () => setCopyState("复制失败"));
      }}><Copy className="size-3" />{copyState || "复制"}</button>}
      {canResume && <button type="button" disabled={busy} onClick={onResume} className="inline-flex items-center gap-1 text-primary disabled:opacity-50"><RotateCcw className="size-3" />{turn.messageId ? "继续生成" : "重试"}</button>}
    </div>
    {!!turn.followups.length && <div className="flex flex-wrap gap-2">{turn.followups.map((question) => <button key={question} type="button" disabled={busy}
      onClick={() => onFollowup(question)} className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted hover:border-primary/40 hover:text-primary disabled:opacity-50">{question}</button>)}</div>}
  </div></CitationScope>;
}

export function ChatThread({ turns, busy, onResume, onFollowup }: {
  turns: ChatTurn[]; busy: boolean; onResume: () => void; onFollowup: (question: string) => void;
}) {
  return <div className="space-y-6">{turns.map((turn, index) => turn.role === "user" ?
    <div key={turn.localId} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-white">{turn.content}</p></div> :
    <AssistantTurn key={turn.localId} turn={turn} busy={busy} onResume={onResume} onFollowup={onFollowup}
      canResume={index === turns.length - 1 && ["failed", "stopped"].includes(turn.status)} />)}</div>;
}
