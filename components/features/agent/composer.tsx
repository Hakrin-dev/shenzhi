"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  CircleHelp,
  Globe,
  Lightbulb,
  Plug,
  Plus,
  Scroll,
  Search,
  Sparkles,
  Square,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FALLBACK_SEARCH_CONFIG } from "@/lib/api/search";
import { AttachmentMenu } from "./attachment-menu";
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

const ENTRY_MODES = [
  { value: "search" as const, label: "搜索", icon: Search },
  { value: "ai" as const, label: "问 AI", icon: Sparkles },
];

const MODE_META = [
  { value: "fast" as const, label: "快速", icon: Zap },
  { value: "deep" as const, label: "深度", icon: Search },
  { value: "idea" as const, label: "灵感", icon: Lightbulb },
  { value: "doubt" as const, label: "质疑", icon: CircleHelp },
] as const;

const MODEL_LABEL: Record<ChatModelId, string> = {
  default: "默认",
  subscription: "订阅",
  byok: "API接入",
};

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
  placement = "down",
  webSearch,
  onWebSearchChange,
}: {
  placement?: "up" | "down";
  webSearch: boolean;
  onWebSearchChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="更多操作"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
          open || webSearch ? "bg-chip text-ink" : "text-muted hover:bg-chip",
        )}
      >
        <Plus
          className={cn("size-5 transition-transform", open && "rotate-45")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-40 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {[
            { label: "插件", icon: Plug, action: () => setOpen(false) },
            { label: "技能", icon: Scroll, action: () => setOpen(false) },
            {
              label: "联网搜索",
              icon: Globe,
              action: () => {
                onWebSearchChange(!webSearch);
                setOpen(false);
              },
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-chip",
                item.label === "联网搜索" && webSearch
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-ink-2",
              )}
            >
              <item.icon className="size-4 text-muted" strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelSelect({
  value,
  onChange,
  options,
}: {
  value: ChatModelId;
  onChange: (v: ChatModelId) => void;
  options: SearchConfig["models"];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-chip px-2.5 text-xs text-ink-2 transition-colors hover:text-ink"
      >
        {MODEL_LABEL[value]}
        <ChevronDown
          className={cn("size-3 text-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-28 rounded-xl border border-line bg-card p-1 shadow-pop">
          {options.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={!m.enabled}
              title={m.enabled ? undefined : m.reason}
              onClick={() => {
                if (!m.enabled) return;
                onChange(m.value);
                setOpen(false);
              }}
              className={cn(
                "flex h-8 w-full cursor-pointer items-center rounded-lg px-2.5 text-xs transition-colors",
                !m.enabled && "cursor-not-allowed opacity-40",
                m.value === value
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-ink-2 hover:bg-chip",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeSelect({
  placement = "down",
  value,
  onChange,
  modes,
}: {
  placement?: "up" | "down";
  value: ChatReplyMode;
  onChange: (v: ChatReplyMode) => void;
  modes: ChatReplyMode[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const allowed = MODE_META.filter((m) => modes.includes(m.value));
  const current = allowed.find((m) => m.value === value) ?? allowed[0] ?? MODE_META[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
      >
        <current.icon className="size-4" strokeWidth={1.8} />
        {current.label}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 w-36 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {allowed.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                onChange(m.value);
                setOpen(false);
              }}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                m.value === value
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-ink-2 hover:bg-chip",
              )}
            >
              <m.icon className="size-4" strokeWidth={1.8} />
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryModeSelect({
  mode,
  onChange,
  placement = "down",
}: {
  mode: ComposerEntryMode;
  onChange: (mode: ComposerEntryMode) => void;
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const current = ENTRY_MODES.find((m) => m.value === mode) ?? ENTRY_MODES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
      >
        <current.icon className="size-4" strokeWidth={1.8} />
        {current.label}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 w-36 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {ENTRY_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                onChange(m.value);
                setOpen(false);
              }}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                m.value === mode
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-ink-2 hover:bg-chip",
              )}
            >
              <m.icon className="size-4" strokeWidth={1.8} />
              {m.label}
            </button>
          ))}
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
  menuPlacement = "down",
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
  menuPlacement?: "up" | "down";
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
  const showAiControls = !isHome || entryMode === "ai";

  const [innerMode, setInnerMode] = useState<ChatReplyMode>("fast");
  const [innerModel, setInnerModel] = useState<ChatModelId>("default");
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

  return (
    <div className="rounded-2xl bg-card p-3 shadow-pop">
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
      <div className="relative">
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
          rows={2}
          maxLength={2000}
          className="h-[72px] w-full resize-none bg-transparent px-1.5 pt-1 text-sm leading-relaxed text-ink outline-none placeholder:text-faint"
        />
        {showAiControls && (
          <div className="absolute right-1 top-0.5">
            <ModelSelect
              value={model}
              onChange={setModel}
              options={config.models}
            />
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        {showAiControls && (
          <>
            <PlusMenu
              placement={menuPlacement}
              webSearch={webSearch}
              onWebSearchChange={setWebSearch}
            />
            <AttachmentMenu
              placement={menuPlacement}
              accept={config.upload.accept.join(",")}
              maxFiles={config.upload.max_files}
              maxSizeMb={config.upload.max_size_mb}
              onAdd={(item) => {
                if (attachments.length >= config.upload.max_files) return;
                setAttachments([...attachments, item]);
              }}
            />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isHome ? (
            <EntryModeSelect
              mode={entryMode}
              onChange={onEntryModeChange ?? (() => {})}
              placement={menuPlacement}
            />
          ) : (
            <ModeSelect
              placement={menuPlacement}
              value={replyMode}
              onChange={setReplyMode}
              modes={config.modes}
            />
          )}
          {busy && onStop ? (
            <button
              type="button"
              aria-label="停止生成"
              onClick={onStop}
              className="flex size-9 cursor-pointer items-center justify-center rounded-xl bg-ink text-white hover:bg-ink/90"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="发送"
              onClick={() => submit()}
              className={cn(
                "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
                value.trim()
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-chip text-faint",
              )}
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
