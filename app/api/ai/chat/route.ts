/**
 * B 模块 —— POST /api/ai/chat（统一 AI 对话接口）
 *
 * 前后端协议：
 *   入参: ChatRequest（types/index.ts 结构体）
 *   返回: text/event-stream SSE
 *         事件顺序: [sources?] → token (多次) → done | error
 *
 * 实现说明：
 *   - 当前为「原型模拟真实模型」：按 style/messages 构造不同回复文本，逐字/token 延迟 yield
 *   - 接入真实模型时，只需替换 createModelStream() 内调用（例如 OpenAI / Anthropic SDK），
 *     前后端协议和客户端完全保持不变。
 *   - 所有出口统一写 SSE；错误也通过 error 事件返回，避免 500 断开导致前端无提示。
 *   - 后端侧也检测 ngrok 拦截请求头，便于 A 用 ngrok 地址联调（虽然后端是同域，
 *     但请求头必须传对，否则前端 fetchSSE 会被拦截）。
 */

import { NextRequest } from "next/server";
import type {
  ChatMessage,
  ChatRequest,
  ChatSource,
  ChatStyle,
  ChatStreamEventType,
} from "@/types";
import { buildModelMessages } from "@/lib/chat-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
 *  DeepSeek 真实模型接入配置
 *  环境变量全部无 NEXT_PUBLIC_ 前缀 → 仅服务端可读，永不泄露前端
 * ======================================================= */
const DEEPSEEK_API_KEY =
  process.env.DEEPSEEK_API_KEY?.trim() || "";
const DEEPSEEK_BASE_URL = (
  process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com/v1"
).replace(/\/+$/, "");
/**
 * 前端 Composer 可能传三种 A 协议档位常量：
 *   "default" | "subscription" | "byok"
 * 这三种没有对应的 DeepSeek 模型名，统一回落到 env 默认模型。
 * 其他模型名（如 "gpt-4o-mini"、"deepseek-chat"、"deepseek-reasoner"）原样透传。
 */
const DEEPSEEK_DEFAULT_MODEL =
  process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
const A_PROTOCOL_FALLBACKS = new Set(["default", "subscription", "byok"]);

function resolveModel(raw: string | undefined | null): string {
  if (!raw) return DEEPSEEK_DEFAULT_MODEL;
  return A_PROTOCOL_FALLBACKS.has(raw) ? DEEPSEEK_DEFAULT_MODEL : raw;
}

/**
 * 从 DeepSeek 非 2xx 响应中提取结构化错误，转为标准 { code, message }。
 * 完整打印原始响应体到 server console，便于排查（避免"瞎猜"类 bug，经验 ID:1055145）。
 */
async function extractDeepSeekError(res: Response): Promise<{
  code: string;
  message: string;
}> {
  let raw = "";
  try {
    raw = await res.text();
  } catch (_) {
    /* ignore */
  }
  // eslint-disable-next-line no-console
  console.error(
    `[DeepSeek] HTTP ${res.status} ${res.statusText} | raw body (前 2000 字):\n${raw.slice(0, 2000)}`,
  );
  let code = String(res.status);
  let message = `模型服务返回 HTTP ${res.status} ${res.statusText}`;
  try {
    const j = JSON.parse(raw || "{}");
    // DeepSeek 错误格式：{ error: { code: "invalid_api_key", message: "..." } }
    const inner = j?.error;
    if (inner?.code) code = String(inner.code);
    if (inner?.message) message = String(inner.message);
    else if (j?.message) message = String(j.message);
  } catch (_) {
    /* 非 JSON 错误直接用原始文本前 200 字 */
    if (raw) message = raw.slice(0, 200);
  }
  return { code, message };
}

/** 把 OpenAI 兼容 SSE 的 data: 行拆出来，逐 token yield
 * UPDATE: 2026-08-21 Task 4 · R1 推理模型 thinking_content 支持
 *  - deepseek-reasoner 会额外在 delta 上写 reasoning_content（思考链，正文前先吐）。
 *  - 新增 yield { type: "thinking", token: string } 事件，createModelStream 透传 → SSE meta/delta 推前端。
 */
async function* streamDeepSeekChunks(
  res: Response,
  signal: AbortSignal,
): AsyncGenerator<
  | { type: "token"; token: string }
  | { type: "thinking"; token: string }
  | { type: "error"; code: string; message: string },
  void,
  unknown
> {
  if (!res.body) {
    yield { type: "error", code: "EMPTY_BODY", message: "模型响应无响应体" };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) return;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 \n\n 分隔
      let sepIdx;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of rawEvent.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === "[DONE]") return; // OpenAI/DeepSeek 结束信号
          try {
            const payload = JSON.parse(data);
            const choice0 = payload?.choices?.[0];
            // 正文 delta（所有模型都会有）
            const delta = choice0?.delta?.content;
            if (delta && typeof delta === "string") {
              yield { type: "token", token: delta };
            }
            // 推理链 delta（deepseek-reasoner 等 R 系列；正文出现前可能多帧连续）
            const reasoning = choice0?.delta?.reasoning_content;
            if (reasoning && typeof reasoning === "string") {
              yield { type: "thinking", token: reasoning };
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[DeepSeek] 解析 SSE data 失败:", data.slice(0, 200));
          }
        }
      }
    }
    // 收尾字节
    buffer += decoder.decode();
  } catch (err) {
    if (signal.aborted) return;
    const msg = (err as Error)?.message || "流式读取中断";
    // eslint-disable-next-line no-console
    console.error("[DeepSeek] 流式读取异常:", err);
    yield { type: "error", code: "STREAM_READ_ERROR", message: msg };
  } finally {
    reader.releaseLock?.();
  }
}

/* -------- 工具：写 SSE 事件 -------- */
function sseLine(
  type: ChatStreamEventType,
  payload: Record<string, unknown> = {},
): string {
  return (
    "data: " +
    JSON.stringify({ type, ...payload }) +
    "\n\n"
  );
}

function encodeText(text: string) {
  return new TextEncoder().encode(text);
}

/**
 * 不同回复风格的 temperature 设定（文档：通过 System Prompt + 模型参数共同控制，
 * 不需要四套不同模型）。temperature 影响「发散程度」：
 *   - fast      0.3  要结论，稳定不胡扯
 *   - deep      0.6  系统分析，兼顾严谨和多样性
 *   - inspire   1.1  发散思考，稍微拉高（≤1.2 防止胡言乱语）
 *   - question  0.8  批判视角，要条理也要一点锐度
 * reasoning 模型会忽略 temperature 但传了不报错
 */
const STYLE_TEMPERATURE: Record<ChatStyle, number> = {
  fast: 0.3,
  deep: 0.6,
  inspire: 1.0,
  question: 0.85,
};

/**
 * 【B 独立验收核心 · DeepSeek 真实模型流式】
 *  输入：
 *    opts.model     —— 前端 Composer 选中的 modelId（A 协议三档常量 by resolveModel 回退）
 *    opts.style     —— 决定 System Prompt（在 messages[0].system 里已拼好）+ temperature
 *    opts.messages  —— 调用方传 buildModelMessages 的结果（system + 历史 + 附件/联网上下文）
 *    opts.webSearch —— 暂留，真实 sources / 联网搜索由 C 模块负责（B 不单独联网）
 *    opts.signal    —— 用户点 Stop / 客户端断开都会触发 abort → 同步传给 DeepSeek fetch，立即停烧 token
 *
 *  输出事件顺序：
 *    0~1 次 sources?（当前 C 未接入时不发；以后可改为 chat-stream.ts 传过来的 webSearchSources）
 *    N 次 token（逐 delta 文本）
 *    1 次 done / 1 次 error
 */
async function* createModelStream(opts: {
  model: string;
  style: ChatStyle;
  messages: ChatMessage[];
  webSearch: boolean;
  signal: AbortSignal;
}): AsyncGenerator<
  | { type: "sources"; sources: ChatSource[] }
  | { type: "thinking"; token: string }
  | { type: "token"; token: string }
  | { type: "done"; content: string; thinkingContent?: string }
  | { type: "error"; code: string; message: string },
  void,
  unknown
> {
  const { style, messages, signal } = opts;

  // 0. Key 兜底：防止刚改 .env 忘了重启 dev 服务导致读不到
  if (!DEEPSEEK_API_KEY) {
    yield {
      type: "error",
      code: "MISSING_DEEPSEEK_KEY",
      message:
        "未读取到 DEEPSEEK_API_KEY。请检查 shenzhi/.env.local 是否配置了正确的 Key，并重启 Next.js 服务（环境变量仅在启动时加载）。",
    };
    return;
  }

  // 1. 构造最小兼容字段集（经验 939355：只发标准字段，避免供应商特有字段导致 400）
  const model = resolveModel(opts.model);
  const isReasoningModel = /reasoner|r1/i.test(model) || model.includes("R1");
  // UPDATE: 2026-08-21 Task 4 · R1 推理模型推荐参数：
  //   - temperature：R1 官方文档说模型自己控制节奏，传 0 或 undefined 更稳；
  //     这里采用"如果是推理模型就不传 temperature"的策略，避免 400 风险。
  //   - max_tokens：R1 上下文预算大，拉到 8192；V3 维持 4096（怕长输出计费爆炸 + 原型可读）。
  const temperature = isReasoningModel
    ? undefined
    : (STYLE_TEMPERATURE[style] ?? 0.7);
  const maxTokens = isReasoningModel ? 8192 : 4096;
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    stream: true,
    // stream_options: { include_usage: true }  —— DeepSeek 当前不支持，不传
  };
  if (temperature !== undefined) payload.temperature = temperature;

  // eslint-disable-next-line no-console
  console.log(
    `[DeepSeek] → ${url} | model=${model} | t=${temperature} | messages=${messages.length} | time=${new Date().toISOString()}`,
  );

  // 2. 发请求（透传 signal：abort 时立即断开，防止继续计费）
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store",
    });
  } catch (e) {
    if (signal.aborted) return;
    const name = (e as { name?: string })?.name;
    const msg = (e as Error).message || "网络请求失败";
    // 典型：ETIMEDOUT / ECONNRESET / 代理问题
    yield {
      type: "error",
      code: name && name !== "Error" ? name : "NETWORK_ERROR",
      message: `无法连接到 ${DEEPSEEK_BASE_URL}：${msg}（请检查本机网络 / 代理 / DEEPSEEK_BASE_URL 是否正确）`,
    };
    return;
  }

  // 3. 非 2xx → 结构化转标准 error
  if (!res.ok) {
    const err = await extractDeepSeekError(res);
    yield { type: "error", code: err.code, message: err.message };
    return;
  }

  // 4. 流式逐 token 产出（正文 token + 思考链 thinking token 并行）
  let fullContent = "";
  let fullThinking = "";
  for await (const ev of streamDeepSeekChunks(res, signal)) {
    if (signal.aborted) return;
    if (ev.type === "token") {
      fullContent += ev.token;
      yield ev;
    } else if (ev.type === "thinking") {
      fullThinking += ev.token;
      yield ev;
    } else if (ev.type === "error") {
      yield ev;
      return;
    }
  }
  if (signal.aborted) return;

  // eslint-disable-next-line no-console
  console.log(
    `[DeepSeek] ✅ 生成结束 | model=${model} | 输出字符=${fullContent.length} | 思考链=${fullThinking.length}`,
  );

  yield {
    type: "done",
    content: fullContent,
    thinkingContent: fullThinking || undefined,
  };
}

/* -------- 主路由 -------- */
export async function POST(req: NextRequest) {
  const abortCtl = new AbortController();
  // 客户端断开时取消
  req.signal.addEventListener("abort", () => abortCtl.abort());

  // —— 1. 解析请求体
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch (e) {
    return new NextResponseSSE().push(
      sseLine("error", {
        code: "INVALID_JSON",
        message: "请求体不是合法 JSON: " + (e as Error).message,
      }),
    ).toResponse(400);
  }

  // —— 2. 字段校验（三方联调契约第一道闸）
  const issues: string[] = [];
  if (!body.mode) issues.push("mode 缺失");
  if (typeof body.message !== "string") issues.push("message 缺失或类型错误");
  if (!body.model) issues.push("model 缺失");
  if (!body.style) issues.push("style 缺失");
  if (typeof body.webSearch !== "boolean") issues.push("webSearch 不是 boolean");
  if (!Array.isArray(body.attachments)) issues.push("attachments 不是数组");
  if (!Array.isArray(body.messages)) issues.push("messages 不是数组");
  if (issues.length > 0) {
    return new NextResponseSSE().push(
      sseLine("error", {
        code: "SCHEMA_ERROR",
        message: "ChatRequest 校验失败: " + issues.join("；"),
      }),
    ).toResponse(422);
  }

  // —— 3. 构造最终 messages 数组（真实版本：真正传给 DeepSeek）
  //      结构：[0] system = STYLE_PROMPTS[style] +（附件上下文）+（联网上下文）
  //           [1..N-1] history = body.messages 里的多轮 user/assistant（body.messages
  //                      不包含 system，拼到后面保持顺序）
  //           [N] 当前 user 提问 = 包含在 body.messages 末尾，buildModelMessages 已做追加
  const built = buildModelMessages({
    style: body.style,
    history: body.messages,
    attachments: body.attachments,
    // C 模块前置联网搜索结果：如果前端注册了 webSearchFn，
    // chat-stream.ts 会把搜索结果注入到后续的流式上下文事件中；
    // 以后 B 后端自己想做联网时，再把 sources 通过新字段传进来。
    webSearchSources: [],
  });
  const { messages: builtMessages, attachmentWarnings } = built;

  // —— 4. 写 SSE 流
  const sse = new NextResponseSSE();

  // 异步跑 generator，边跑边 push
  (async () => {
    try {
      // UPDATE: 2026-08-21 P1 Build 修复
      //  ① buildModelMessages 返回值现在是 { messages, attachmentWarnings } 对象，
      //    不再是数组；这里解构后把 messages（数组）传给 createModelStream。
      //  ② 附件告警（ATTACHMENT_TRUNCATED_30K / 60K）：流式开始前立即作为
      //    phase="warning" 的 meta 事件首帧下发，与前端 chat-stream.ts 的
      //    onMeta → ThinkingPanel warnings 卡片链路打通（两端统一）。
      if (attachmentWarnings.length > 0) {
        for (const w of attachmentWarnings) {
          sse.push(
            sseLine("meta", {
              id: (body as any).message_id || "",
              phase: "warning",
              status: "pending",
              code: "ATTACHMENT_WARNING",
              read_count: undefined,
              context_truncated: true,
              warning: w,
            }),
          );
        }
      }

      const gen = createModelStream({
        model: body.model,
        style: body.style,
        // ⚠️ 关键：传 builtMessages（含风格 System Prompt + 附件 + 历史多轮），
        //    而不是原始 body.messages（只有 user/assistant 对，没有 system，
        //    会导致回复风格不生效 / AI 看不懂附件内容）。
        messages: builtMessages,
        webSearch: body.webSearch,
        signal: abortCtl.signal,
      });
      for await (const ev of gen) {
        if (abortCtl.signal.aborted) return;
        switch (ev.type) {
          case "sources":
            sse.push(sseLine("sources", { sources: ev.sources }));
            break;
          case "thinking":
            sse.push(sseLine("meta", {
              phase: "thinking",
              status: "streaming",
              thinking_delta: ev.token,
            }));
            break;
          case "token":
            sse.push(sseLine("token", { token: ev.token }));
            break;
          case "done":
            sse.push(sseLine("done", {
              content: ev.content,
              thinkingContent: (ev as any).thinkingContent ?? undefined,
            }));
            break;
          case "error":
            sse.push(sseLine("error", { code: ev.code, message: ev.message }));
            break;
        }
      }
    } catch (e) {
      if (!abortCtl.signal.aborted) {
        sse.push(
          sseLine("error", {
            code: "MODEL_CRASH",
            message: "模型调用异常: " + (e as Error).message,
          }),
        );
      }
    } finally {
      sse.close();
    }
  })();

  return sse.toResponse(200);
}

/* -------- 轻量 SSE Response 封装（避免依赖第三方库） -------- */
class NextResponseSSE {
  private stream: TransformStream<Uint8Array, Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private closed = false;

  constructor() {
    this.stream = new TransformStream();
    this.writer = this.stream.writable.getWriter();
  }

  push(text: string): this {
    if (this.closed) return this;
    this.writer.write(encodeText(text)).catch(() => {});
    return this;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.writer.close().catch(() => {});
    this.writer.releaseLock?.();
  }

  toResponse(status: number): Response {
    return new Response(this.stream.readable, {
      status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // 禁用 nginx 缓冲 SSE
      },
    });
  }
}
