/** 论文 Feed 卡片 */
export interface FeedPaper {
  id: string;
  date: string;
  venue: string;
  venueTone: "violet" | "amber" | "green";
  authors: string;
  title: string;
  abstract: string;
  aiLink: string;
  tags: string[];
  likes: number;
  citations: number;
  thumb: string;
}

/** 投稿目标(会议/期刊) */
export interface Venue {
  id: string;
  kind: "conference" | "journal";
  abbr: string;
  fullName: string;
  badges: VenueBadgeName[];
  /** [icon, text] 元信息行,支持多行 */
  metaRows: [VenueMetaIcon, string][][];
  chips: string[];
  accent: "danger" | "success";
  /** 仅会议有倒计时 */
  deadline?: {
    label: string;
    dateText: string;
    /** 相对当前时间的毫秒偏移(演示用实时倒计时) */
    offsetMs: number;
  };
}

export type VenueMetaIcon = "folder" | "pin" | "cal" | "chart" | "quote";

export type VenueBadgeName =
  | "CCF A"
  | "CCF C"
  | "CORE A*"
  | "TH-CPL A"
  | "TH-CPL B"
  | "CSRanking"
  | "CAAI A"
  | "CAAI C"
  | "中科院1区"
  | "JCR Q1"
  | "高质量期刊 T1";

/** 学者 */
export interface Scholar {
  id: string;
  nameCn: string;
  nameEn: string;
  initials: string;
  avatarColor: string;
  role: string;
  affiliation: string;
  bio: string;
  citations: string;
  hIndex: number;
  tags: string[];
  followed?: boolean;
}

export interface Publication {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  venue: string;
  citations: string;
  citationsShort: string;
}

/** 知识库文献 */
export interface LibraryItem {
  id: string;
  title: string;
  venue: string;
  arxiv: string;
  authors: string;
  addedAt: string;
  pdfTone: "violet" | "amber" | "green";
}

export interface LibraryFolder {
  name: string;
  count: number;
  active?: boolean;
}

/** AI 研究助手 */
export interface AgentReference {
  id: number;
  venue: string;
  title: string;
  author: string;
  citations: string;
  tone: "violet" | "green" | "amber" | "gray";
  recommended?: boolean;
}

export interface RecentResearch {
  id: string;
  title: string;
  time: string;
  refs: number;
  active?: boolean;
}

/** 论文详情(阅读器) */
export interface PaperDetail {
  id: string;
  title: string;
  authors: string[];
  affiliation: string;
  likes: number;
  page: { current: number; total: number };
  toc: { id: string; label: string; active?: boolean }[];
  abstract: string;
  introduction: string;
}

export interface SimilarPaper {
  title: string;
  meta: string;
}

/** 知识图谱节点 */
export interface GraphNode {
  id: string;
  /** 圆下两行标签:公域 ["Liu", "2024"],私域 ["扩散策略", "2025"] */
  labelLines: [string, string];
  /** 0~1 关系强度 → 圆半径与透明度 */
  weight: number;
  year: number;
  title: string;
  authors: string;
  venue: string;
  citations: string;
  abstract: string;
  /** 右栏「查看论文详情」跳转目标(/papers/[paperId]) */
  paperId?: string;
  /** 私域分层;公域不设 */
  layer?: "mine" | "folder";
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  /** 私域跨层边(虚线) */
  crossLayer?: boolean;
}

export interface PaperGraph {
  origin: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** 左栏列表顺序 */
  relatedIds: string[];
}

/** 专利 */
export interface Patent {
  id: string;
  /** 专利名称 */
  title: string;
  /** 申请号,如 CN202410123456.7 */
  applicationNo: string;
  /** 申请人 */
  applicant: string;
  /** 公开日 YYYY-MM-DD(字典序即可排序) */
  publishedAt: string;
  /** 技术领域(左栏筛选维度) */
  field: string;
  status: "已授权" | "实质审查" | "已公开" | "PCT";
  kind: "发明" | "实用新型";
  /** 被引次数(排序用) */
  citations: number;
}

/** 项目基金 */
export interface Funding {
  id: string;
  /** 项目名称 */
  title: string;
  /** 批准号 */
  grantNo: string;
  /** 负责人 */
  pi: string;
  /** 依托单位 */
  institution: string;
  /** 资助金额,如 300 万元 */
  amount: string;
  /** 起止年限,如 2024-01 ~ 2027-12 */
  period: string;
  /** 资助类别(左栏筛选维度) */
  category: string;
  status: "在研" | "结题";
}

/** 机构统计项 */
export interface InstitutionStat {
  label: string;
  value: string;
}

/** 研究机构 */
export interface Institution {
  id: string;
  nameCn: string;
  nameEn: string;
  /** logo 色块字母,如 THU */
  initials: string;
  logoColor: string;
  type: "高校" | "研究院" | "企业实验室";
  location: string;
  /** 详细介绍:历史沿革、学科优势、代表平台(3~4 句,卡片直接全文展示) */
  intro: string;
  /** 固定 4 项:研究人员 / 年论文 / 总引用 / 国家级平台 */
  stats: InstitutionStat[];
  /** 优势方向 tags */
  fields: string[];
  /** 代表性成果一句话 */
  highlight: string;
  /** 默认已收藏(mock) */
  bookmarked?: boolean;
  /** 综合排名(升序排序用) */
  rank: number;
  /** 年论文数(降序排序用) */
  papersPerYear: number;
}

/** Deep Research 研究计划节 */
export interface DRPlanSection {
  id: string;
  /** 大纲节标题,如 "1. 代表性方法与技术脉络" */
  title: string;
  /** 该节检索意图(计划卡内展示) */
  query: string;
}

/** Deep Research 来源 / 参考文献条目 */
export interface DRSource {
  /** 引用编号 [n] */
  id: number;
  /** 来源墙 chip 用短名,如 "Diffusion Policy" */
  short: string;
  title: string;
  /** 如 "CoRL 2024 · Stanford" */
  venue: string;
  author: string;
  /** 如 "引用 1.8k" */
  citations: string;
  recommended?: boolean;
}

/** Deep Research 报告节 */
export interface DRReportSection {
  /** 与 DRPlanSection.id 对应 */
  id: string;
  heading: string;
  /** 段落,含 [n] 引用标记 */
  paragraphs: string[];
  table?: {
    caption: string;
    header: string[];
    rows: string[][];
    highlightRow?: number;
  };
  /** 编号列表(趋势等) */
  list?: string[];
}

/** Deep Research 报告 */
export interface DRReport {
  question: string;
  title: string;
  abstract: string;
  stats: { read: number; cited: number };
  sections: DRReportSection[];
  references: DRSource[];
}

export type DRStepKind = "search" | "read" | "analyze" | "write";

/** Deep Research 预录步骤事件(确定性时间轴) */
export interface DRStepEvent {
  offsetMs: number;
  kind: DRStepKind;
  label: string;
  /** write 类事件关联的章节 */
  sectionId?: string;
}

/** Deep Research 历史研究条目 */
export interface DRHistoryItem {
  id: string;
  title: string;
  status: "已完成" | "进行中";
  sources: number;
  time: string;
}

/* =========================================================
 *  B 模块 —— 三人联调统一契约
 * =========================================================
 * 重要：2026-08-17 起，A 模块的「ai-search.ts」成为契约源。
 * 本文件 types/index.ts 中保留 ChatStyle/ChatAttachment/ChatSource/ChatRequest
 * 等旧命名做向后兼容（C 模块、composer 等大量代码依赖旧名），
 * 但所有发送给后端 / 跨模块传递时，统一通过 lib/api/search.ts 做适配转换。
 * 新代码请优先从 types/ai-search.ts 导入新命名。
 * ========================================================= */

/** A 模块契约类型的 re-export，ChatStyle 不在这里导出（下方有旧 B 独立定义） */
export type {
  ChatReplyMode,
  ChatAttachment as AIChatAttachment,
  ChatReference,
  ChatSessionType,
  ChatSourceType,
  EntryMode,
  ChatModelId,
  ComposerSubmitPayload,
  CreateChatSessionRequest,
  CreateChatSessionResponse,
  SendChatMessageRequest,
  ChatSession,
  ChatMessageStatus,
  SearchConfig,
  SearchModelOption,
  ApiEnvelope,
  SearchAPIError,
  AIEventMeta,
  AIEventDelta,
  AIEventRefs,
  AIEventFollowups,
  AIEventDone,
  AIEventError,
  AISSEEventName,
  StreamMetaEvent,
  StreamDeltaEvent,
  StreamRefsEvent,
  StreamFollowupsEvent,
  StreamDoneEvent,
  StreamErrorEvent,
} from "./ai-search";

/** 搜索 / 问 AI 双模式（旧名 ChatMode，保持向后兼容） */
export type ChatMode = "search" | "ai";

/**
 * 4 种 AI 回复风格（旧 B 模块命名）—— 值与新 ChatReplyMode 差异：
 *   OLD   NEW
 *   inspire → idea
 *   question → doubt
 * 所以旧 ChatStyle 不能直接 = ChatReplyMode，必须是独立联合类型。
 * Store 中存旧 ChatStyle 即可，发送前通过 mapToAMode 转换。
 */
export type ChatStyle = "fast" | "deep" | "inspire" | "question";

/** 对话消息角色（B 旧命名，与 messages 数组保持一致） */
export type ChatMessageRole = "system" | "user" | "assistant";

/** 单条对话消息 */
export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

/**
 * 附件解析结果（C 模块维护的 B 旧命名）。
 * 与 A 模块标准 ChatAttachment（kind/file_id/ref_id/title）字段完全不同，
 * 发送时通过 lib/ask/draft.ts 的 toAAttachment() 自动转换。
 */
export interface ChatAttachment {
  id: string;
  name: string;
  type: "pdf" | "txt" | "md" | "other";
  size?: number;
  /** 解析出的纯文本内容，作为上下文注入 prompt */
  text?: string;
  /** 上传失败时的错误信息 */
  error?: string;
  /**
   * 兼容通道：如果 C 模块或草稿恢复逻辑已按 A 格式写入 kind/ref_id，
   * 这里保留额外字段承载，避免 TS 报错。发送时 toAAttachment() 会优先使用。
   */
  kind?: "file" | "paper" | "patent" | "funding" | "scholar" | "institution" | "session" | "project";
  ref_id?: string;
}

/** AI 回复来源引用（B 透传给 C 渲染 ReferenceGrid，旧命名保留） */
export interface ChatSource {
  id: number;
  short?: string;
  title: string;
  venue?: string;
  author?: string;
  citations?: string;
  url?: string;
  tone?: "violet" | "green" | "amber" | "gray";
  recommended?: boolean;
  /** 来源类型：对齐 A 的 ChatSourceType 字符串枚举值 */
  type?: "paper" | "patent" | "funding" | "scholar" | "institution" | "web";
  /** 联网搜索片段 / PDF 摘要段落，供 AI 引用卡片展示 */
  snippet?: string;
}

/**
 * 统一 ChatRequest 请求体 —— POST /api/ai/chat
 * 【这是 B 原型后端的请求格式，向后兼容；A 后端走 CreateChatSessionRequest】
 * lib/api/search.ts 会根据 AI_BACKEND_MODE 选择用哪套格式。
 */
export interface ChatRequest {
  /** A 模块维护：search（普通搜索）/ ai（问 AI） */
  mode: ChatMode;
  /** 当前用户单条输入（也包含在 messages 最后一条，便于快速读取） */
  message: string;
  /** Composer 选中的模型 ID */
  model: string;
  /** Composer 选中的回复风格（旧命名 ChatStyle） */
  style: ChatStyle;
  /** C 模块维护：是否开启联网搜索 */
  webSearch: boolean;
  /** C 模块维护：已解析附件列表（B 旧格式，发送前转换） */
  attachments: ChatAttachment[];
  /** 完整多轮上下文，B 模块负责追加与持久化 */
  messages: ChatMessage[];
}

/** SSE 流式事件 —— B 模块前后端协议（旧命名，/api/ai/chat 仍使用） */
export type ChatStreamEventType =
  | "token"        // 增量 token
  | "sources"      // 来源引用（一次性下发）
  | "done"         // 流结束
  | "error";       // 中途出错

export interface ChatStreamEvent {
  type: ChatStreamEventType;
  /** token: 增量文本 */
  token?: string;
  /** sources: 引用来源数组 */
  sources?: ChatSource[];
  /** done: 最终完整文本（供本地持久化） */
  content?: string;
  /** error: 错误码与用户可读消息 */
  code?: string;
  message?: string;
}

/** AI 对话状态（B 模块内部 UI 用） */
export type ChatSessionStatus =
  | "idle"
  | "sending"
  | "streaming"
  | "stopped"
  | "error";

/** 单条 UI 消息（含 sources / refs / followups / 思考 meta / 状态） */
export interface ChatUIMessage extends ChatMessage {
  id: string;
  /** assistant 消息: 引用来源（A 协议 ChatReference[] → 旧 ChatSource[]，渲染用） */
  sources?: ChatSource[];
  /** assistant 消息: 追问建议（followups 事件），可点击发送 */
  followupItems?: string[];
  /** assistant 消息: 当前加载状态 */
  status?: ChatSessionStatus;
  /** 思考阶段元信息（meta 事件累计） */
  meta?: {
    read_count?: number;
    phase?: "检索中" | "正在生成";
    context_truncated?: boolean;
    duration_ms?: number;
  };
  /** 该助手消息对应的 message_id（停止/继续生成接口需要） */
  backendMsgId?: string;
  /** 错误消息（UI 层展示） */
  error?: string;
  /** 错误码（ngrok / rate-limit / timeout / 20001~20010） */
  errorCode?: string;
}
