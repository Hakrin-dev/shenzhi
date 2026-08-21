"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Globe,
  Lightbulb,
  Plug,
  Plus,
  Scroll,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { popoverPosition, usePopoverPlacement } from "@/lib/use-popover-placement";
import { DEFAULT_CHAT_MODEL } from "@/lib/data/chat-models";
import { FALLBACK_SEARCH_CONFIG } from "@/lib/api/search";
import { AttachmentMenu } from "./attachment-menu";
import { ModelProviderBadge } from "./model-provider-badge";
import { questionSchema } from "@/lib/validations";
import type { ComposerEntryMode } from "@/types";
import type {
  ChatAttachment,
  ChatModelId,
  ChatReplyMode,
  ComposerSubmitPayload,
  SearchConfig,
  SearchModelOption,
} from "@/types/ai-search";

export type { ComposerEntryMode, ComposerSubmitPayload } from "@/types";

const ENTRY_MODES = [
  { value: "search" as const, label: "普通搜索", icon: Search },
  { value: "ai" as const, label: "问 AI", icon: Sparkles },
];

const MODE_META = [
  { value: "fast" as const, label: "快速", icon: Zap, description: "低延迟，适合日常提问" },
  { value: "deep" as const, label: "深度", icon: Search, description: "多路检索，适合文献综述" },
  { value: "idea" as const, label: "灵感", icon: Lightbulb, description: "发散思路与研究方向" },
  { value: "doubt" as const, label: "质疑", icon: CircleHelp, description: "批判性分析与反驳" },
] as const;

const CIRCLE_BTN =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-chip hover:text-ink";

function useCloseOnOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);
  return ref;
}

function PlusMenu({
  webSearch,
  onWebSearchChange,
  replyMode,
  onReplyModeChange,
  modes,
  isHome,
  entryMode,
  onEntryModeChange,
}: {
  webSearch: boolean;
  onWebSearchChange: (v: boolean) => void;
  replyMode: ChatReplyMode;
  onReplyModeChange: (v: ChatReplyMode) => void;
  modes: ChatReplyMode[];
  isHome: boolean;
  entryMode: ComposerEntryMode;
  onEntryModeChange?: (mode: ComposerEntryMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => {
    setOpen(false);
    setStyleOpen(false);
  });
  const placement = usePopoverPlacement(open, ref, 280);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="更多选项"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          CIRCLE_BTN,
          (open || webSearch) && "border-primary/30 bg-primary-soft text-primary",
        )}
      >
        <Plus
          className={cn("size-4 transition-transform", open && "rotate-45")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 z-[120] w-48 rounded-2xl border border-line bg-card p-1.5 shadow-pop",
            popoverPosition(placement),
          )}
        >
          {isHome &&
            ENTRY_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  onEntryModeChange?.(m.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors",
                  entryMode === m.value
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-ink-2 hover:bg-chip",
                )}
              >
                <m.icon className="size-4 text-muted" strokeWidth={1.8} />
                {m.label}
              </button>
            ))}
          {isHome && <div className="my-1 border-t border-line/80" />}
          <button
            type="button"
            onClick={() => setStyleOpen((v) => !v)}
            className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
          >
            <SlidersHorizontal className="size-4 text-muted" strokeWidth={1.8} />
            <span className="flex-1 text-left">回复风格</span>
            <ChevronRight
              className={cn(
                "size-3.5 text-faint transition-transform",
                styleOpen && "rotate-90",
              )}
            />
          </button>
          {styleOpen &&
            MODE_META.filter((m) => modes.includes(m.value)).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  onReplyModeChange(m.value);
                  setOpen(false);
                  setStyleOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-xl py-1 pl-9 pr-2.5 text-sm transition-colors",
                  m.value === replyMode
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-ink-2 hover:bg-chip",
                )}
              >
                <m.icon className="size-3.5" strokeWidth={1.8} />
                {m.label}
              </button>
            ))}
          {[
            { label: "插件", icon: Plug, action: () => setOpen(false) },
            { label: "技能", icon: Scroll, action: () => setOpen(false) },
            {
              label: "联网搜索",
              icon: Globe,
              toggle: true,
              active: webSearch,
              action: () => onWebSearchChange(!webSearch),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.action();
                if (!item.toggle) setOpen(false);
              }}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors hover:bg-chip",
                item.active && "bg-primary-soft font-medium text-primary",
                !item.active && "text-ink-2",
              )}
            >
              <item.icon className="size-4 text-muted" strokeWidth={1.8} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.toggle && (
                <span
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    webSearch ? "bg-agent" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                      webSearch ? "left-4" : "left-0.5",
                    )}
                  />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelPicker({
  value,
  onChange,
  options,
  quota,
}: {
  value: ChatModelId;
  onChange: (v: ChatModelId) => void;
  options: SearchModelOption[];
  quota: SearchConfig["quota"];
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const placement = usePopoverPlacement(open, ref, 360);
  const current =
    options.find((m) => m.value === value) ??
    options.find((m) => m.enabled) ??
    options[0];
  const usedPct =
    quota.limit > 0
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0;

  return (
    <div ref={ref} className="relative min-w-0 shrink">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`当前模型：${current?.label ?? "模型"}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 max-w-[11rem] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
          open
            ? "border-primary/40 bg-primary-soft text-primary"
            : "border-line bg-card text-ink hover:border-primary/25 hover:bg-chip",
        )}
      >
        {current && (
          <ModelProviderBadge provider={current.provider} size="sm" />
        )}
        <span className="truncate font-medium">
          {current?.label ?? "选择模型"}
        </span>
        {open ? (
          <ChevronUp className="size-3.5 shrink-0 text-faint" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-faint" />
        )}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="选择模型"
          className={cn(
            "absolute left-0 z-[120] w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-pop",
            popoverPosition(placement),
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5 text-[11px]">
            <span className="font-medium text-ink-2">{usedPct}% 已用</span>
            <span className="text-faint">
              今日 {quota.used}/{quota.limit}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-medium text-muted">
            <span>可选模型</span>
            <ChevronUp className="size-3.5 text-faint" />
          </div>
          <div className="max-h-72 overflow-y-auto px-1.5 pb-1.5">
            {options.map((m) => {
              const selected = m.value === value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={!m.enabled}
                  title={
                    m.enabled
                      ? undefined
                      : m.reason === "not_subscribed"
                        ? "需要订阅"
                        : m.reason === "no_api_key"
                          ? "请在设置中配置 API Key"
                          : m.reason
                  }
                  onClick={() => {
                    if (!m.enabled) return;
                    onChange(m.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "mb-1 flex w-full cursor-pointer items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors last:mb-0",
                    !m.enabled && "cursor-not-allowed opacity-50",
                    selected
                      ? "border-primary/35 bg-primary-soft"
                      : "border-transparent hover:bg-chip",
                  )}
                >
                  <ModelProviderBadge provider={m.provider} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm font-semibold leading-tight",
                        selected ? "text-primary" : "text-ink",
                      )}
                    >
                      {m.label}
                    </span>
                    {m.description && (
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                        {m.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-line px-3 py-2.5 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-agent" />
              升级订阅以解锁 GPT、Claude、Gemini 等模型
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComposerShell({
  value,
  onChange,
  onSend,
  placeholder,
  variant = "agent",
  entryMode = "ai",
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

  const [innerMode, setInnerMode] = useState<ChatReplyMode>("fast");
  const [innerModel, setInnerModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [innerWeb, setInnerWeb] = useState(false);
  const [innerFiles, setInnerFiles] = useState<ChatAttachment[]>([]);

  const replyMode = replyModeProp ?? innerMode;
  const model = modelProp ?? innerModel;
  const webSearch = webSearchProp ?? innerWeb;
  const attachments = attachmentsProp ?? innerFiles;

  const setReplyMode = onReplyModeChange ?? setInnerMode;
  const setModel = onModelChange ?? setInnerModel;
  const setWebSearch = onWebSearchChange ?? setInnerWeb;
  const setAttachments = onAttachmentsChange ?? setInnerFiles;

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

  const keyboardHint = isHome
    ? "Alt + Enter 搜索论文"
    : "Enter 发送 · Shift + Enter 换行";

  return (
    <div className="relative overflow-visible rounded-2xl border border-line/80 bg-card p-3 shadow-pop sm:p-4">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
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
            if (isHome && e.altKey) {
              submit("search");
              return;
            }
            submit();
          }
        }}
        placeholder={placeholder}
        rows={3}
        maxLength={2000}
        className="min-h-[4.5rem] w-full resize-none bg-transparent px-0.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint sm:min-h-[5rem] sm:text-base"
      />

      <div className="mt-2 flex items-center gap-2 border-t border-line/60 pt-2.5">
        <PlusMenu
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
          replyMode={replyMode}
          onReplyModeChange={setReplyMode}
          modes={config.modes}
          isHome={isHome}
          entryMode={entryMode}
          onEntryModeChange={onEntryModeChange}
        />
        <AttachmentMenu
          accept={config.upload.accept.join(",")}
          maxFiles={config.upload.max_files}
          maxSizeMb={config.upload.max_size_mb}
          onAdd={(item) => {
            if (attachments.length >= config.upload.max_files) return;
            setAttachments([...attachments, item]);
          }}
        />
        <ModelPicker
          value={model}
          onChange={setModel}
          options={config.models}
          quota={config.quota}
        />

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-[11px] text-faint sm:inline">
            {keyboardHint}
          </span>
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
                  ? "bg-primary text-white hover:bg-primary-dark"
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
