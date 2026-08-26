"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Search, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_CHAT_MODEL } from "@/lib/data/chat-models";
import { FALLBACK_SEARCH_CONFIG } from "@/lib/api/search";
import { ComposerControlPicker } from "./composer-control-picker";
import { questionSchema } from "@/lib/validations";
import type { ComposerEntryMode } from "@/types";
import type {
  ChatAttachment,
  ChatModelId,
  ChatReplyMode,
  ComposerSubmitPayload,
  SearchConfig,
} from "@/types/ai-search";

export type { ComposerEntryMode, ComposerSubmitPayload } from "@/types";

const MODE_PILL =
  "flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors";

function SearchModeSwitch({
  mode,
  onChange,
}: {
  mode: ComposerEntryMode;
  onChange: (mode: ComposerEntryMode) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-pressed={mode === "search"}
        onClick={() => onChange("search")}
        className={cn(
          MODE_PILL,
          mode === "search"
            ? "bg-primary-soft text-primary"
            : "text-muted hover:bg-chip hover:text-ink-2",
        )}
      >
        <Search className="size-4 shrink-0" strokeWidth={1.8} />
        简单搜索
      </button>
      <button
        type="button"
        aria-pressed={mode === "ai"}
        onClick={() => onChange("ai")}
        className={cn(
          MODE_PILL,
          mode === "ai"
            ? "bg-violet-100 text-violet-800"
            : "text-muted hover:bg-chip hover:text-ink-2",
        )}
      >
        <Sparkles className="size-4 shrink-0" strokeWidth={1.8} />
        智能搜索
      </button>
    </div>
  );
}

export function ComposerShell({
  value,
  onChange,
  onSend,
  placeholder,
  variant = "agent",
  entryMode: entryModeProp,
  onEntryModeChange,
  replyMode: replyModeProp,
  onReplyModeChange,
  model: modelProp,
  onModelChange,
  webSearch: webSearchProp,
  onWebSearchChange,
  attachments: attachmentsProp,
  onAttachmentsChange,
  config = FALLBACK_SEARCH_CONFIG,
  busy = false,
  onStop,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (payload: ComposerSubmitPayload) => void;
  placeholder: string;
  variant?: "home" | "agent";
  entryMode?: ComposerEntryMode;
  onEntryModeChange?: (mode: ComposerEntryMode) => void;
  replyMode?: ChatReplyMode;
  onReplyModeChange?: (mode: ChatReplyMode) => void;
  model?: ChatModelId;
  onModelChange?: (model: ChatModelId) => void;
  webSearch?: boolean;
  onWebSearchChange?: (v: boolean) => void;
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (items: ChatAttachment[]) => void;
  config?: SearchConfig;
  busy?: boolean;
  onStop?: () => void;
}) {
  const isHome = variant === "home";
  const canSend = Boolean(value.trim());

  const [innerEntryMode, setInnerEntryMode] = useState<ComposerEntryMode>("ai");
  const [innerMode, setInnerMode] = useState<ChatReplyMode>("fast");
  const [innerDepth, setInnerDepth] = useState<"fast" | "deep">("fast");
  const [innerModel, setInnerModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [innerWeb, setInnerWeb] = useState(false);
  const [innerFiles, setInnerFiles] = useState<ChatAttachment[]>([]);
  const [controlOpen, setControlOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  const replyMode = replyModeProp ?? innerMode;
  const entryMode = entryModeProp ?? innerEntryMode;
  const setEntryMode = onEntryModeChange ?? setInnerEntryMode;
  const isSmartSearch = entryMode === "ai";
  const depthMode =
    replyMode === "deep" || replyMode === "fast"
      ? (replyMode as "fast" | "deep")
      : innerDepth;
  const model = modelProp ?? innerModel;
  const webSearch = webSearchProp ?? innerWeb;
  const attachments = attachmentsProp ?? innerFiles;

  const setReplyMode = onReplyModeChange ?? setInnerMode;
  const setDepthMode = (v: "fast" | "deep") => {
    setInnerDepth(v);
    if (replyMode === "fast" || replyMode === "deep") setReplyMode(v);
  };
  const setModel = onModelChange ?? setInnerModel;
  const setWebSearch = onWebSearchChange ?? setInnerWeb;
  const setAttachments = onAttachmentsChange ?? setInnerFiles;

  useEffect(() => {
    if (!controlOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!controlRef.current?.contains(e.target as Node)) {
        setControlOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [controlOpen]);

  const buildPayload = (intent?: ComposerEntryMode): ComposerSubmitPayload => ({
    entryMode: intent ?? entryMode,
    question: value.trim(),
    mode: replyMode,
    model,
    web_search: webSearch,
    attachments,
  });

  const submit = (intent?: ComposerEntryMode) => {
    const parsed = questionSchema.safeParse(value);
    if (!parsed.success) return;
    onSend(buildPayload(intent));
  };

  return (
    <div
      className={cn(
        "relative overflow-visible rounded-2xl border border-line/80 bg-card shadow-pop",
        isHome ? "p-5" : "p-3",
      )}
    >
      {attachments.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {attachments.map((item, i) => (
            <button
              key={`${item.kind}-${item.file_id ?? item.ref_id ?? i}`}
              type="button"
              onClick={() =>
                setAttachments(attachments.filter((_, idx) => idx !== i))
              }
              className="rounded-full bg-chip px-2.5 py-1 text-[11px] text-ink-2 hover:bg-panel"
              title="移除"
            >
              {item.title ?? item.ref_id ?? item.file_id ?? item.kind}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            if (busy) return;
            submit();
          }
        }}
        placeholder={placeholder}
        rows={isHome ? 3 : 2}
        maxLength={2000}
        className={cn(
          "w-full resize-none bg-transparent px-0.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint",
          isHome ? "min-h-[4.5rem]" : "min-h-[3.25rem]",
        )}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <SearchModeSwitch mode={entryMode} onChange={setEntryMode} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isSmartSearch && (
            <div ref={controlRef} className="relative min-w-0">
              <ComposerControlPicker
                model={model}
                onModelChange={setModel}
                replyMode={replyMode}
                onReplyModeChange={setReplyMode}
                depthMode={depthMode}
                onDepthModeChange={setDepthMode}
                webSearch={webSearch}
                onWebSearchChange={setWebSearch}
                options={config.models}
                quota={config.quota}
                anchorRef={controlRef}
                open={controlOpen}
                onOpenChange={setControlOpen}
              />
            </div>
          )}

          {busy && onStop ? (
            <button
              type="button"
              aria-label="停止生成"
              onClick={onStop}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink/90"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="发送"
              onClick={() => submit()}
              disabled={!canSend}
              className={cn(
                "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
                canSend
                  ? isSmartSearch
                    ? "bg-primary text-white hover:bg-primary-dark"
                    : "bg-agent text-white hover:bg-agent/90"
                  : "border border-line bg-chip text-faint",
                !canSend && "cursor-not-allowed",
              )}
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
