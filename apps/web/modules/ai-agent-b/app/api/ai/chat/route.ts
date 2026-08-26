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

import { NextRequest, NextResponse } from "next/server";
import {
  MissingProviderError,
  resolveFollowupLLM,
  resolveLLM,
} from "@b/lib/model-providers";
import {
  assertChatQuota,
  jsonUnauthorized,
  quotaErrorResponse,
  rebuildTrustedModelMessages,
  requireApiUser,
} from "@b/lib/server/chat-security";
import type {
  ChatMessage,
  ChatRequest,
  ChatSource,
  ChatStyle,
  ChatStreamEventType,
} from "@b/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function extractUpstreamError(
  res: Response,
  providerLabel: string,
): Promise<{ code: string; message: string }> {
  let raw = "";
  try {
    raw = await res.text();
  } catch (_) {
    /* ignore */
  }
  // eslint-disable-next-line no-console
  console.error(
    `[${providerLabel}] HTTP ${res.status} ${res.statusText} | raw body (前 2000 字):\n${raw.slice(0, 2000)}`,
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
async function* streamOpenAIChunks(
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
  | { type: "followups"; items: string[] }
  | { type: "done"; content: string; thinkingContent?: string }
  | { type: "error"; code: string; message: string },
  void,
  unknown
> {
  const { style, messages, signal } = opts;

  let llm;
  try {
    llm = resolveLLM(opts.model);
  } catch (e) {
    if (e instanceof MissingProviderError) {
      yield { type: "error", code: "MISSING_API_KEY", message: e.message };
      return;
    }
    throw e;
  }

  const model = llm.model;
  const isReasoningModel =
    llm.provider === "deepseek" &&
    (/reasoner|r1/i.test(model) || model.includes("R1"));
  // UPDATE: 2026-08-21 Task 4 · R1 推理模型推荐参数：
  //   - temperature：R1 官方文档说模型自己控制节奏，传 0 或 undefined 更稳；
  //     这里采用"如果是推理模型就不传 temperature"的策略，避免 400 风险。
  //   - max_tokens：R1 上下文预算大，拉到 8192；V3 维持 4096（怕长输出计费爆炸 + 原型可读）。
  const temperature = isReasoningModel
    ? undefined
    : (STYLE_TEMPERATURE[style] ?? 0.7);
  const maxTokens = isReasoningModel ? 8192 : 4096;
  const url = `${llm.baseUrl}/chat/completions`;
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
    `[LLM/${llm.provider}] → ${url} | model=${model} | t=${temperature} | messages=${messages.length}`,
  );

  // 2. 发请求（透传 signal：abort 时立即断开，防止继续计费）
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
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
      message: `无法连接到 ${llm.baseUrl}：${msg}`,
    };
    return;
  }

  // 3. 非 2xx → 结构化转标准 error
  if (!res.ok) {
    const err = await extractUpstreamError(res, llm.provider);
    yield { type: "error", code: err.code, message: err.message };
    return;
  }

  // 4. 流式逐 token 产出（正文 token + 思考链 thinking token 并行）
  let fullContent = "";
  let fullThinking = "";
  for await (const ev of streamOpenAIChunks(res, signal)) {
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
    `[LLM/${llm.provider}] ✅ 生成结束 | chars=${fullContent.length}`,
  );

  // —— 5. 动态生成 3 个追问建议（基于当前问答，不使用完整 system prompt，避免跑偏）
  let followupItems: string[] = [];
  if (!signal.aborted && fullContent.length > 20) {
    try {
      const followupLlm = resolveFollowupLLM();
      const followupModel = followupLlm.model;
      // 只取最后一条用户问题 + 助手回答，上下文最精准，追问不容易跑偏
      // （如果带了一堆 system prompt / 附件全文 / 历史消息，V3 容易被干扰）
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const lastUserContent = lastUserMsg ? lastUserMsg.content : "";
      // 回答过长时截断（保留前 1500 字符足够生成相关追问）
      const answerForFollowup = fullContent.length > 1500
        ? fullContent.slice(0, 1500) + "…"
        : fullContent;
      const followupMessages = [
        {
          role: "system",
          content: "你是一个善于引导对话的助手。你的任务是根据用户的问题和AI的回答，生成3个用户最可能继续追问的问题。",
        },
        { role: "user", content: lastUserContent || "用户提问" },
        { role: "assistant", content: answerForFollowup },
        {
          role: "user",
          content:
            "请根据以上回答，生成3个用户最可能继续追问的问题。要求：" +
            "1) 必须紧扣回答内容，和当前话题高度相关；" +
            "2) 由浅入深，逐步拓展（细节→对比→应用/延伸）；" +
            "3) 句式自然口语化，不要用模板腔；" +
            "4) 用纯 JSON 数组返回：[\"问题1\", \"问题2\", \"问题3\"]；" +
            "5) 不要输出任何其他文字，只返回 JSON 数组。",
        },
      ];
      const fRes = await fetch(`${followupLlm.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${followupLlm.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: followupModel,
          messages: followupMessages,
          stream: false,
          temperature: 0.8,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (fRes.ok) {
        const fData = await fRes.json();
        const fText = fData?.choices?.[0]?.message?.content ?? "";
        // 去掉可能的 markdown 代码块包裹
        const cleaned = fText
          .replace(/```json\s*/gi, "")
          .replace(/```\s*$/g, "")
          .trim();
        // 尝试从文本中提取 JSON 数组
        const match = cleaned.match(/\[[\s\S]*?\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length >= 2) {
              followupItems = parsed.slice(0, 3).map((s: unknown) => String(s).trim()).filter(Boolean);
            }
          } catch {
            // JSON 解析失败，尝试按行拆分
            const lines = cleaned.split("\n").map((l: string) => l.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean);
            followupItems = lines.slice(0, 3).filter((l: string) => l.length > 4);
          }
        } else {
          // 没有 JSON 格式，尝试按行/序号拆分
          const lines = cleaned
            .split("\n")
            .map((l: string) => l.replace(/^\d+[\.\)]\s*/, "").replace(/^[-*•]\s*/, "").trim())
            .filter((l: string) => l.length > 4 && l.length < 60 && !l.startsWith("```"));
          followupItems = lines.slice(0, 3);
        }
        // eslint-disable-next-line no-console
        console.log(
          `[LLM/${followupLlm.provider}] ✅ 追问 | model=${followupModel} | n=${followupItems.length}`,
        );
        if (followupItems.length === 0) {
          console.warn("[followups] 原始返回:", fText.slice(0, 200));
        }
      }
    } catch (e) {
      // 追问生成失败不影响主流程，静默降级
      console.warn("[followups] 生成失败，跳过:", (e as Error).message);
    }
  }

  yield {
    type: "followups",
    items: followupItems,
  };

  yield {
    type: "done",
    content: fullContent,
    thinkingContent: fullThinking || undefined,
  };
}

/* -------- 主路由 -------- */
export async function POST(req: NextRequest) {
  let user: { id: string };
  try {
    user = await requireApiUser();
  } catch {
    return jsonUnauthorized();
  }

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

  try {
    await assertChatQuota(user.id, body.style);
  } catch (e) {
    return quotaErrorResponse(e);
  }

  const { messages: trustedMessages } = rebuildTrustedModelMessages(body);

  // —— 4. 写 SSE 流
  const sse = new NextResponseSSE();

  // 异步跑 generator，边跑边 push
  (async () => {
    try {
      const gen = createModelStream({
        model: body.model,
        style: body.style,
        messages: trustedMessages,
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
          case "followups":
            sse.push(sseLine("followups", { items: (ev as any).items || [] }));
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
