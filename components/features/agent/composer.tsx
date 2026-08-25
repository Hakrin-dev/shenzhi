"use client";

/**
 * UPDATE: 2026-08-24 alphaxiv 风格极简 Composer
 *   —— 底部工具栏只保留左侧 + 号和右侧发送按钮
 *   —— 所有控制项收进 + 号下拉菜单：
 *        1. 模型切换（子菜单）
 *        2. 添加附件
 *        3. 联网搜索（toggle）
 *        4. 深度思考 / 回答模式（子菜单）
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  Globe,
  Lightbulb,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Square,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FALLBACK_SEARCH_CONFIG } from "@/lib/api/search";
import { uploadFile } from "@/lib/api/uploads";
import { questionSchema } from "@/lib/validations";
import { useComposerStore } from "@/stores/composer";
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

/* -------------------------------------------------------------------------- */
/* 工具 hook：点击外部关闭                                                     */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* 开关 Toggle 组件                                                           */
/* -------------------------------------------------------------------------- */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        on ? "bg-primary" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
          on ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* PlusMenu：alphaxiv 风格 + 号菜单                                           */
/* -------------------------------------------------------------------------- */
function PlusMenu({
  placement = "up",
  model,
  onModelChange,
  models,
  webSearch,
  onWebSearchChange,
  replyMode,
  onReplyModeChange,
  replyModes,
  onAddAttachment,
  uploadAccept,
  uploadMaxFiles,
  uploadMaxSizeMb,
}: {
  placement?: "up" | "down";
    model: ChatModelId | string;
    onModelChange: (v: ChatModelId | string) => void;
    models: SearchConfig["models"];
  webSearch: boolean;
  onWebSearchChange: (v: boolean) => void;
  replyMode: ChatReplyMode;
  onReplyModeChange: (v: ChatReplyMode) => void;
  replyModes: ChatReplyMode[];
  onAddAttachment: (item: ChatAttachment) => void;
  uploadAccept: string;
  uploadMaxFiles: number;
  uploadMaxSizeMb: number;
}) {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<"model" | "mode" | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useCloseOnOutside(open, () => {
    setOpen(false);
    setSubMenu(null);
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addB = useComposerStore((s) => s.addAttachment);

  const currentModel = models.find((m) => m.value === model) ?? models[0];
  const allowedModes = MODE_META.filter((m) => replyModes.includes(m.value));
  const currentMode = allowedModes.find((m) => m.value === replyMode) ?? allowedModes[0] ?? MODE_META[0];

  const hasActiveFeature = webSearch || model !== "default" || replyMode !== "fast";

  const extToBType = (name: string): "pdf" | "txt" | "md" | "other" => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") return "pdf";
    if (ext === "md") return "md";
    if (ext === "txt") return "txt";
    return "other";
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, uploadMaxFiles);
    if (list.length === 0) return;
    setUploading(true);
    setOpen(false);
    try {
      for (const file of list) {
        if (file.size > uploadMaxSizeMb * 1024 * 1024) {
          const errAtt: ChatAttachment = {
            kind: "file",
            file_id: `err_${Date.now().toString(36)}`,
            title: file.name,
          };
          addB({
            id: `att_err_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            type: extToBType(file.name),
            size: file.size,
            kind: "file",
            error: `文件过大（${(file.size / 1024 / 1024).toFixed(2)}MB，上限 ${uploadMaxSizeMb}MB）`,
          });
          onAddAttachment(errAtt);
          continue;
        }
        try {
          const upload = await uploadFile(file);
          addB({
            id: upload.file_id,
            name: upload.filename,
            type: extToBType(upload.filename),
            size: file.size,
            kind: "file",
            text: upload.parse_status === "ok" ? upload.text : undefined,
            error:
              upload.parse_status === "failed"
                ? upload.warning || "解析失败（仅支持文字版 PDF / TXT / MD）"
                : undefined,
          });
          onAddAttachment({
            kind: "file",
            file_id: upload.file_id,
            title: upload.filename,
          });
        } catch (e) {
          addB({
            id: `att_err_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            type: extToBType(file.name),
            size: file.size,
            kind: "file",
            error: (e as Error).message || "上传失败",
          });
          onAddAttachment({
            kind: "file",
            file_id: `err_${Date.now().toString(36)}`,
            title: file.name,
          });
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      {/* + 号按钮 */}
      <button
        type="button"
        aria-label="更多操作"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setSubMenu(null);
        }}
        className={cn(
          "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-all",
          open || hasActiveFeature
            ? "bg-chip text-ink"
            : "hover:bg-chip hover:text-ink",
        )}
      >
        <Plus
          className={cn("size-5 transition-transform", open && "rotate-45")}
        />
      </button>

      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={uploadAccept}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
        }}
      />

      {/* 主菜单 */}
      {open && (
        <div
          className={cn(
            "absolute left-0 z-[120] w-52 rounded-2xl border border-line bg-card p-1 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {/* 1. 模型切换 */}
          <button
            type="button"
            onClick={() => setSubMenu(subMenu === "model" ? null : "model")}
            className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink transition-colors hover:bg-chip"
          >
            <Sparkles className="size-4 text-muted" strokeWidth={1.8} />
            <span className="flex-1 text-left">
              模型
              <span className="ml-1 text-xs text-muted">{currentModel?.label}</span>
            </span>
            <ChevronRight className={cn("size-3.5 text-faint transition-transform", subMenu === "model" && "rotate-90")} />
          </button>

          {subMenu === "model" && (
            <div className="mx-1 my-1 space-y-0.5 rounded-xl bg-panel/60 p-1">
              {models.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  disabled={!m.enabled}
                  title={m.enabled ? undefined : m.reason}
                  onClick={() => {
                    if (!m.enabled) return;
                    onModelChange(m.value);
                    setSubMenu(null);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 w-full cursor-pointer items-center rounded-lg px-2 text-[13px] transition-colors",
                    !m.enabled && "cursor-not-allowed opacity-40",
                    m.value === model
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-ink-2 hover:bg-chip",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          <div className="mx-2 my-0.5 h-px bg-line/60" />

          {/* 2. 添加附件 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink transition-colors hover:bg-chip disabled:opacity-50"
          >
            <Paperclip className="size-4 text-muted" strokeWidth={1.8} />
            <span className="flex-1 text-left">添加附件</span>
          </button>

          <div className="mx-2 my-0.5 h-px bg-line/60" />

          {/* 3. 联网搜索 */}
          <div
            className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink transition-colors hover:bg-chip"
            onClick={() => onWebSearchChange(!webSearch)}
          >
            <Globe className="size-4 text-muted" strokeWidth={1.8} />
            <span className="flex-1 text-left">联网搜索</span>
            <Toggle on={webSearch} onChange={onWebSearchChange} />
          </div>

          <div className="mx-2 my-0.5 h-px bg-line/60" />

          {/* 4. 深度思考 / 回答模式 */}
          <button
            type="button"
            onClick={() => setSubMenu(subMenu === "mode" ? null : "mode")}
            className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink transition-colors hover:bg-chip"
          >
            <Lightbulb className="size-4 text-muted" strokeWidth={1.8} />
            <span className="flex-1 text-left">
              深度思考
              <span className="ml-1 text-xs text-muted">{currentMode.label}</span>
            </span>
            <ChevronRight className={cn("size-3.5 text-faint transition-transform", subMenu === "mode" && "rotate-90")} />
          </button>

          {subMenu === "mode" && (
            <div className="mx-1 my-1 space-y-0.5 rounded-xl bg-panel/60 p-1">
              {allowedModes.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    onReplyModeChange(m.value);
                    setSubMenu(null);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] transition-colors",
                    m.value === replyMode
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-ink-2 hover:bg-chip",
                  )}
                >
                  <m.icon className="size-3.5" strokeWidth={1.8} />
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- 工具函数 ---------------- */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------- */
/* 首页入口模式切换：「搜索 / 问 AI」                                            */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* ComposerShell 主组件                                                       */
/* -------------------------------------------------------------------------- */
export function ComposerShell({
  value,
  onChange,
  onSend,
  placeholder,
  menuPlacement = "up",
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
  model?: ChatModelId | string;
  onModelChange?: (model: ChatModelId | string) => void;
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
  const showAiControls = !isHome || entryMode === "ai";

  const [innerMode, setInnerMode] = useState<ChatReplyMode>("fast");
  const [innerModel, setInnerModel] = useState<ChatModelId | string>("default");
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

  // 输入框自适应高度
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  // 挂载时和 value 变化时自动调整高度
  useEffect(() => {
    autoResize();
  }, [value]);

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
    <div className="relative overflow-visible rounded-2xl border border-line/80 bg-card p-3 shadow-pop">
      {/* 附件预览区 */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((item, i) => {
            const name =
              item.title ||
              (item as any).name ||
              item.file_id ||
              item.ref_id ||
              "附件";
            const size = (item as any).size;
            const hasError = !!(item as any).error;
            return (
              <div
                key={`${item.kind}-${item.file_id ?? item.ref_id ?? i}`}
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors",
                  hasError
                    ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
                    : "border-line/80 bg-chip/60 text-ink-2 hover:border-line",
                )}
              >
                <FileText className="size-3.5 shrink-0 text-faint" />
                <span className="max-w-[160px] truncate">{name}</span>
                {size != null && (
                  <span className="shrink-0 text-[10px] text-faint">
                    {formatSize(size)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setAttachments(attachments.filter((_, idx) => idx !== i))
                  }
                  className="ml-0.5 shrink-0 rounded p-0.5 text-faint transition-colors hover:bg-panel hover:text-ink"
                  title="移除"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 输入框（自动高度） */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autoResize();
        }}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            if (busy) return;
            // 首页 Alt+Enter：无论当前模式，强制按「搜索」提交
            if (isHome && e.altKey) {
              submit("search");
              return;
            }
            submit();
          }
        }}
        placeholder={placeholder}
        rows={1}
        maxLength={2000}
        className="max-h-[200px] min-h-[3.25rem] w-full resize-none bg-transparent px-0.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint"
      />

      {/* 底部工具栏 — alphaxiv 极简风格：只保留 + 号 和 发送按钮 */}
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        {/* 左侧：+ 号菜单 */}
        {showAiControls && (
          <PlusMenu
            placement={menuPlacement}
            model={model}
            onModelChange={setModel}
            models={config.models}
            webSearch={webSearch}
            onWebSearchChange={setWebSearch}
            replyMode={replyMode}
            onReplyModeChange={setReplyMode}
            replyModes={config.modes}
            onAddAttachment={(item) => {
              if (attachments.length >= config.upload.max_files) return;
              setAttachments([...attachments, item]);
            }}
            uploadAccept={config.upload.accept.join(",")}
            uploadMaxFiles={config.upload.max_files}
            uploadMaxSizeMb={config.upload.max_size_mb}
          />
        )}

        {/* 非 AI 模式下占位保持对齐 */}
        {!showAiControls && <div className="w-9" />}

        {/* 右侧：首页入口模式切换 + 快捷键提示 + 发送/停止按钮 */}
        <div className="flex shrink-0 items-center gap-2">
          {isHome && (
            <EntryModeSelect
              mode={entryMode}
              onChange={onEntryModeChange ?? (() => {})}
              placement={menuPlacement}
            />
          )}
          {!busy && (
            <span className="hidden text-[10.5px] text-faint sm:inline">
              <kbd className="rounded border border-line/60 bg-chip px-1 py-0.5 font-medium">
                Enter
              </kbd>
              <span className="mx-1">发送</span>
              {isHome && (
                <>
                  <kbd className="rounded border border-line/60 bg-chip px-1 py-0.5 font-medium">
                    Alt+Enter
                  </kbd>
                  <span className="mx-1">搜索</span>
                </>
              )}
              <kbd className="rounded border border-line/60 bg-chip px-1 py-0.5 font-medium">
                Shift+Enter
              </kbd>
              <span className="ml-1">换行</span>
            </span>
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
                  ? "bg-primary text-white hover:bg-primary/90"
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
