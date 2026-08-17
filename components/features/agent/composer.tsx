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
  Square,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentMenu } from "./attachment-menu";
import {
  MODEL_OPTIONS,
  STYLE_OPTIONS,
  makeAttachmentId,
  useComposerStore,
} from "@/stores/composer";
import type { ChatAttachment, ChatStyle } from "@/types";

/* =========================================================
 *  新 ComposerShell
 *  - 不再有内部局部 state，全部走 useComposerStore 共享
 *  - props: 受控 value/onChange 若传（兼容 search-hero 等组件原有API），
 *           则 props 优先级高于 store；不传则 store 为唯一真源
 *  - 新增：联网搜索开关 UI（Globe 高亮 + PlusMenu 项）
 *  - 新增：附件上传解析 + 芯片展示 + 删除
 *  - 新增：发送中模式切换为 Stop 按钮（由调用方控制 isStreaming）
 * ========================================================= */

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

/* ---------------- 插件/技能/联网搜索菜单（PlusMenu） ---------------- */
function PlusMenu({
  placement = "down",
}: {
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const webSearch = useComposerStore((s) => s.webSearch);
  const setWebSearch = useComposerStore((s) => s.setWebSearch);

  const ITEMS = [
    { label: "插件", icon: Plug, toggleable: false },
    { label: "技能", icon: Scroll, toggleable: false },
    {
      label: "联网搜索",
      icon: Globe,
      toggleable: true,
      active: webSearch,
      onClick: () => setWebSearch(!webSearch),
    },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="更多操作"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
          open ? "bg-chip text-ink" : "text-muted hover:bg-chip",
        )}
      >
        <Plus
          className={cn("size-5 transition-transform", open && "rotate-45")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-44 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {ITEMS.map((item) => {
            const isActive = item.toggleable && item.active;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.toggleable) item.onClick?.();
                  setOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-chip",
                  isActive
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-ink-2",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-primary" : "text-muted",
                  )}
                  strokeWidth={1.8}
                />
                {item.label}
                {item.toggleable && isActive && (
                  <span className="ml-auto size-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- 模型选择（现在写入 store） ---------------- */
function ModelSelect() {
  const model = useComposerStore((s) => s.model);
  const setModel = useComposerStore((s) => s.setModel);
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

  const current =
    MODEL_OPTIONS.find((m) => m.id === model) ?? MODEL_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-chip px-2.5 text-xs text-ink-2 transition-colors hover:text-ink"
      >
        {current.label}
        <ChevronDown
          className={cn("size-3 text-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-line bg-card p-1 shadow-pop">
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setModel(m.id);
                setOpen(false);
              }}
              className={cn(
                "flex h-8 w-full cursor-pointer items-center rounded-lg px-2.5 text-xs transition-colors",
                m.id === model
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

/* ---------------- 风格选择（现在写入 store） ---------------- */
const STYLE_ICONS: Record<ChatStyle, typeof Zap> = {
  fast: Zap,
  deep: Search,
  inspire: Lightbulb,
  question: CircleHelp,
};

function StyleSelect({ placement = "down" }: { placement?: "up" | "down" }) {
  const style = useComposerStore((s) => s.style);
  const setStyle = useComposerStore((s) => s.setStyle);
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const current = STYLE_OPTIONS.find((m) => m.value === style) ?? STYLE_OPTIONS[0];
  const Icon = STYLE_ICONS[current.value] ?? Zap;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
      >
        <Icon className="size-4" strokeWidth={1.8} />
        {current.label}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 w-56 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {STYLE_OPTIONS.map((m) => {
            const MI = STYLE_ICONS[m.value] ?? Zap;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setStyle(m.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-11 w-full cursor-pointer flex-col items-start justify-center rounded-lg px-2.5 text-sm transition-colors",
                  m.value === style
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-ink-2 hover:bg-chip",
                )}
              >
                <span className="flex items-center gap-2">
                  <MI className="size-4" strokeWidth={1.8} />
                  {m.label}
                </span>
                <span className="ml-6 text-[11px] text-faint">{m.desc}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- 附件上传芯片 + 文件解析 ---------------- */
function AttachmentChips({ onRemove }: { onRemove?: (id: string) => void }) {
  const attachments = useComposerStore((s) => s.attachments);
  const removeAttachment = useComposerStore((s) => s.removeAttachment);
  const addAttachment = useComposerStore((s) => s.addAttachment);
  const updateAttachment = useComposerStore((s) => s.updateAttachment);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      const id = makeAttachmentId();
      const ext = f.name.split(".").pop()?.toLowerCase();
      const type: ChatAttachment["type"] =
        ext === "pdf"
          ? "pdf"
          : ext === "txt"
            ? "txt"
            : ext === "md" || ext === "markdown"
              ? "md"
              : "other";

      // C 模块占位：此处是通用 TXT 提取；PDF 需 C 接入 pdf.js 或后端解析后回写。
      // 约定：先写入「上传中」条目，解析完成再 updateAttachment({ text })。
      addAttachment({
        id,
        name: f.name,
        type,
        size: f.size,
      });

      try {
        if (type === "txt" || type === "md") {
          const text = await f.text();
          updateAttachment(id, { text: text.slice(0, 60_000) });
        } else if (type === "pdf") {
          // PDF 文本提取 C 模块负责；此处留空避免阻塞。
          updateAttachment(id, {
            error:
              "PDF 文本解析由 C 模块接入，当前为演示占位。C 接入后会自动回填 text 字段。",
          });
        } else {
          updateAttachment(id, {
            error: `暂不支持 .${ext} 文件，将仅作为名称附带。`,
          });
        }
      } catch (e) {
        updateAttachment(id, { error: "文件读取失败: " + (e as Error).message });
      }
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((a) => {
        const loading = a.text === undefined && a.error === undefined;
        const isError = !!a.error;
        return (
          <div
            key={a.id}
            className={cn(
              "group inline-flex max-w-[280px] items-center gap-1.5 rounded-lg border border-line bg-card px-2 py-1 text-[12px]",
              isError && "border-danger/40 bg-danger/5",
            )}
            title={isError ? a.error : undefined}
          >
            <UploadCloud
              className={cn(
                "size-3.5 shrink-0",
                loading
                  ? "animate-pulse text-muted"
                  : isError
                    ? "text-danger"
                    : "text-primary",
              )}
            />
            <span className="truncate text-ink-2">{a.name}</span>
            {loading ? (
              <span className="shrink-0 text-[10px] text-faint">解析中…</span>
            ) : (
              <button
                type="button"
                aria-label="移除附件"
                onClick={() => {
                  removeAttachment(a.id);
                  onRemove?.(a.id);
                }}
                className="shrink-0 cursor-pointer rounded-md p-0.5 text-faint transition-colors hover:bg-chip hover:text-ink"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* 隐藏的 input 点击触发（这里放一个即可，也可留给 AttachmentMenu 统一管） */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

/* ---------------- ComposerShell 主组件（共享 store） ---------------- */
export interface ComposerShellProps {
  /** 受控模式（A 模块搜索页/首页搜索框使用）：外部传入 value/onChange */
  value?: string;
  onChange?: (v: string) => void;
  onSend?: () => void;
  placeholder?: string;
  menuPlacement?: "up" | "down";
  /** 流式加载中 → 发送按钮变 Stop（B 模块 agent-chat 传入） */
  isStreaming?: boolean;
  /** Stop 回调 */
  onStop?: () => void;
  /** 是否禁用（加载中等） */
  disabled?: boolean;
}

export function ComposerShell({
  value,
  onChange,
  onSend,
  placeholder,
  menuPlacement = "down",
  isStreaming = false,
  onStop,
  disabled = false,
}: ComposerShellProps) {
  const storeMessage = useComposerStore((s) => s.message);
  const storeSetMessage = useComposerStore((s) => s.setMessage);
  const webSearch = useComposerStore((s) => s.webSearch);

  // 受控模式优先 props，否则走 store
  const current = value !== undefined ? value : storeMessage;
  const handleChange = (v: string) => {
    if (onChange) onChange(v);
    else storeSetMessage(v);
  };

  const handleSend = () => {
    if (disabled || !current.trim()) return;
    onSend?.();
  };

  const handleStop = () => {
    onStop?.();
  };

  return (
    <div className="rounded-2xl bg-card p-3 shadow-pop">
      {/* 附件芯片区（有附件时才出现） */}
      <AttachmentChips />

      <div className="relative">
        <textarea
          value={current}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              !disabled
            ) {
              e.preventDefault();
              if (isStreaming) handleStop();
              else handleSend();
            }
          }}
          placeholder={
            placeholder ??
            "使用'@'引用或使用'/'唤起插件或技能…（联网搜索已" +
              (webSearch ? "开启" : "关闭") +
              "）"
          }
          rows={2}
          className="h-[72px] w-full resize-none bg-transparent px-1.5 pt-1 text-sm leading-relaxed text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed disabled:opacity-60"
        />
        {/* 右上:模型选择 */}
        <div className="absolute right-1 top-0.5">
          <ModelSelect />
        </div>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        {/* 左下: +(插件/技能/联网搜索) 与 别针(引用菜单) */}
        <PlusMenu placement={menuPlacement} />
        <AttachmentMenu placement={menuPlacement} />

        {/* 联网开关指示（全局态同步高亮） */}
        {webSearch && (
          <span
            title="联网搜索已开启，AI 将先检索互联网再回答"
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary"
          >
            <Globe className="size-3" />
            联网搜索
          </span>
        )}

        {/* 右下:风格选择 + 发送/停止 */}
        <div className="ml-auto flex items-center gap-2">
          <StyleSelect placement={menuPlacement} />
          {isStreaming ? (
            <button
              type="button"
              aria-label="停止生成"
              onClick={handleStop}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-danger/90 px-3 text-[12px] font-medium text-white transition-colors hover:bg-danger"
            >
              <Square className="size-3.5 fill-current" />
              停止
            </button>
          ) : (
            <button
              type="button"
              aria-label="发送"
              disabled={disabled || !current.trim()}
              onClick={handleSend}
              className={cn(
                "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
                disabled || !current.trim()
                  ? "bg-chip text-faint"
                  : "bg-primary text-white hover:bg-primary/90",
                disabled && "cursor-not-allowed",
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
