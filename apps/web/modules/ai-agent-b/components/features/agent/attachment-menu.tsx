"use client";

/**
 * UPDATE: 2026-08-20 C1 附件上传+解析贯通
 *   - 原 pickFiles() 行为：uploadFile(file) 仅返回 { file_id }，
 *     生成 A 格式 ChatAttachment({ kind: "file", file_id, title }) 给 onAdd()，
 *     —— 问题：ChatAttachment(B 结构).text 没填，AI 读不到附件正文。
 *   - 新 pickFiles() 行为：
 *     1) uploads.ts 扩展 uploadFile 返回 UploadsDataFull：{file_id, filename, parse_status, text, truncated, warning}
 *     2) 直接调用 useComposerStore（A 模块 composer-store / B 模块 zustand 导出同名方法），
 *        把 {id, name, type, size, text/error, kind="file", ref_id=undefined} 的
 *        B 格式 ChatAttachment 写入 store。这样 agent-chat 发送时 buildCreateSessionRequest →
 *        buildModelMessages(attachments) → buildAttachmentContext 才能把 text 注入 DeepSeek prompt。
 *     3) 仍然调用 onAdd(A 格式) —— 保持与 composer-shell 的 onAttachmentsChange 回调兼容，
 *        ComposerShell 附件 chips 仍然能渲染（toBAttachment 在草稿通道把 A 转回 B，两种路径最终都在 store 对齐）。
 *   - 引用知识库（RefItem）：保持 A 格式不变，C 解析能力不涉及这部分；
 *     但也写入 store.addAttachment(B 格式) 一份 —— 用 kind/ref_id/name 填充。
 *   修改日志：任务日志/对于C的修改/2026.8.20-C模块-附件上传解析.md
 */

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileUp,
  FolderUp,
  History,
  Layers,
  Library,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { feedPapers } from "@/lib/data/papers";
import { patents } from "@/lib/data/patents";
import { fundings } from "@/lib/data/funding";
import { scholars } from "@/lib/data/scholars";
import { institutions } from "@/lib/data/institutions";
import { projects } from "@/lib/data/projects";
import { uploadFile } from "@/lib/api/uploads";
import type { ChatAttachment, ChatAttachmentKind } from "@b/types/ai-search";
import { useComposerStore } from "@b/stores/composer";
import type { ChatAttachment as BChatAttachment } from "@b/types";

interface RefItem {
  kind: ChatAttachmentKind;
  ref_id: string;
  title: string;
}

interface RefGroup {
  label: string;
  items: RefItem[];
}

const KNOWLEDGE_GROUPS: RefGroup[] = [
  {
    label: "论文库",
    items: feedPapers.slice(0, 3).map((p) => ({
      kind: "paper" as const,
      ref_id: p.id,
      title: p.title,
    })),
  },
  {
    label: "专利库",
    items: patents.slice(0, 3).map((p) => ({
      kind: "patent" as const,
      ref_id: p.id,
      title: p.title,
    })),
  },
  {
    label: "项目基金库",
    items: fundings.slice(0, 3).map((f) => ({
      kind: "funding" as const,
      ref_id: f.id,
      title: f.title,
    })),
  },
  {
    label: "学者关系",
    items: scholars.slice(0, 3).map((s) => ({
      kind: "scholar" as const,
      ref_id: s.id,
      title: `${s.nameCn} · ${s.affiliation}`,
    })),
  },
  {
    label: "研究机构",
    items: institutions.slice(0, 3).map((i) => ({
      kind: "institution" as const,
      ref_id: i.id,
      title: `${i.nameCn} · ${i.type}`,
    })),
  },
];

const HISTORY_GROUPS: RefGroup[] = [
  {
    label: "历史对话",
    items: [
      { kind: "session", ref_id: "demo-ultralong", title: "长上下文 Transformer 调研" },
      { kind: "session", ref_id: "demo-neurips", title: "NeurIPS 2026 投稿筛选" },
      { kind: "session", ref_id: "demo-diffusion", title: "扩散模型效率优化" },
    ],
  },
];

const PROJECT_GROUPS: RefGroup[] = [
  {
    label: "科研项目",
    items: projects.map((p) => ({
      kind: "project" as const,
      ref_id: p.id,
      title: p.name,
    })),
  },
];

function extToBType(name: string): BChatAttachment["type"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  return "other";
}

function RefPanel({
  groups,
  expandable = false,
  onPick,
}: {
  groups: RefGroup[];
  expandable?: boolean;
  onPick: (item: RefItem) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!expandable) {
    return (
      <div className="w-64 rounded-xl border border-line bg-card p-1.5 shadow-pop">
        {groups.flatMap((group) =>
          group.items.map((item) => (
            <button
              key={item.ref_id}
              type="button"
              onClick={() => onPick(item)}
              className="flex h-8 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-chip"
            >
              <span className="truncate">{item.title}</span>
            </button>
          )),
        )}
      </div>
    );
  }

  return (
    <div className="w-64 rounded-xl border border-line bg-card p-1.5 shadow-pop">
      {groups.map((group) => {
        const open = expanded === group.label;
        return (
          <div key={group.label}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded(open ? null : group.label)}
              className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-chip"
            >
              <span className="flex-1 truncate text-left">{group.label}</span>
              {open ? (
                <ChevronDown className="size-3.5 text-faint" />
              ) : (
                <ChevronRight className="size-3.5 text-faint" />
              )}
            </button>
            {open && (
              <ul className="mb-1 ml-3 border-l border-line pl-2">
                {group.items.map((item) => (
                  <li key={item.ref_id}>
                    <button
                      type="button"
                      title={item.title}
                      onClick={() => onPick(item)}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-chip hover:text-ink-2"
                    >
                      <BookOpen className="size-3 shrink-0 text-faint" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function attachmentFromUpload(
  upload: Awaited<ReturnType<typeof uploadFile>>,
  file: File,
): ChatAttachment {
  return {
    kind: "file",
    file_id: upload.file_id,
    title: upload.filename,
    size: file.size,
    type: extToBType(upload.filename),
    text: upload.parse_status === "ok" ? upload.text : undefined,
    error:
      upload.parse_status === "failed"
        ? upload.warning || "解析失败（仅支持文字版 PDF / TXT / MD）"
        : undefined,
  };
}

export function AttachmentMenu({
  placement = "down",
  onAdd,
  accept = ".pdf,.docx,.md,.txt",
  maxFiles = 5,
  maxSizeMb = 20,
}: {
  placement?: "up" | "down";
  onAdd?: (item: ChatAttachment) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeMb?: number;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const addB = useComposerStore((s) => s.addAttachment);

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, maxFiles);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        // 大小拦截（与服务端 route.ts 的 MAX_BYTES_PER_FILE 一致）
        if (file.size > maxSizeMb * 1024 * 1024) {
          // 失败也塞一个 B 附件（带 error），让 UI chips 提示用户（而不是静默丢掉）
          addB({
            id: `att_err_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            type: extToBType(file.name),
            size: file.size,
            kind: "file",
            error: `文件过大（${(file.size / 1024 / 1024).toFixed(2)}MB，上限 ${maxSizeMb}MB）`,
          });
          continue;
        }

        // 上传 + 解析（B 模式走本地 C route；A 模式走 /api/v1/uploads 代理）
        let upload: Awaited<ReturnType<typeof uploadFile>>;
        try {
          upload = await uploadFile(file);
        } catch (e) {
          addB({
            id: `att_err_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            type: extToBType(file.name),
            size: file.size,
            kind: "file",
            error: (e as Error).message || "上传失败",
          });
          continue;
        }

        const bAtt: BChatAttachment = {
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
        };
        addB(bAtt);

        // 兼容：仍然回调 onAdd（A 格式），ComposerShell 内部的 innerFiles/onAttachmentsChange 能渲染 chips。
        //     （agent-chat.tsx 下的 composer shell 是受控的，props.attachments 来自 zustand store，
        //      因此会优先用 store 的 B 格式；这里调 onAdd 是为了首页 search-hero 非受控场景也能显示 chips）
        onAdd?.(attachmentFromUpload(upload, file));

        // 如果有「截断警告」，把 warning 拼到 error（但不标 parse_status=failed）——
        // 这样 buildAttachmentContext 里的 `a.error` 过滤会跳过，text 仍会注入 prompt；
        // UI 层面 composer chips 没显展示 warning（下一阶段如需展示可在 chips 上挂 tooltip）。
        if (upload.warning && upload.parse_status === "ok") {
          // 留 console 做联调期观测
          // eslint-disable-next-line no-console
          console.info("[C1 upload]", upload.filename, upload.warning);
        }
      }
    } finally {
      setUploading(false);
      setOpen(false);
    }
  };

  const addRef = (item: RefItem) => {
    const bAtt: BChatAttachment = {
      id: item.ref_id,
      name: item.title,
      // 引用类型都塞 md type，避免 type 枚举超范围
      type: "md",
      kind: item.kind,
      ref_id: item.ref_id,
    };
    addB(bAtt);
    onAdd?.({ kind: item.kind, ref_id: item.ref_id, title: item.title });
    setOpen(false);
  };

  const REF_ITEMS = [
    { label: "引用知识库", icon: Library, groups: KNOWLEDGE_GROUPS, expandable: true },
    { label: "引用历史对话", icon: History, groups: HISTORY_GROUPS },
    { label: "引用科研项目", icon: Layers, groups: PROJECT_GROUPS },
  ];

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          void pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label="上传附件或引用"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
          open ? "bg-chip text-ink" : "text-muted hover:bg-chip",
        )}
      >
        <Paperclip className="size-4.5" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-52 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
          >
            <FileUp className="size-4 text-muted" strokeWidth={1.8} />
            {uploading ? "上传中…" : "上传本地文件"}
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
          >
            <FolderUp className="size-4 text-muted" strokeWidth={1.8} />
            上传本地文件夹
          </button>

          {REF_ITEMS.map((item) => (
            <div key={item.label} className="group/ref relative">
              <button
                type="button"
                className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip group-hover/ref:bg-chip"
              >
                <item.icon className="size-4 text-muted" strokeWidth={1.8} />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronRight className="size-3.5 text-faint" />
              </button>
              <div className="invisible absolute bottom-0 left-full z-50 pl-1.5 opacity-0 transition-opacity duration-100 group-hover/ref:visible group-hover/ref:opacity-100">
                <RefPanel
                  groups={item.groups}
                  expandable={item.expandable}
                  onPick={addRef}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
