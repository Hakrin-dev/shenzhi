import assert from "node:assert/strict";
import { test } from "node:test";
import { readSseStream } from "../../clients/backend/sse";
import { streamChatMessage } from "../../clients/backend/chat";
import { apiJson, ApiError } from "../../clients/backend/http";
import { restoreTurns } from "../../features/chat/services/conversation";

function responseFor(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    // Split every UTF-8 character and every CRLF boundary.
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }), { headers: { "Content-Type": "text/event-stream" } });
}

test("SSE parses CRLF, comments, multiline data and a final unterminated event", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get("Last-Event-ID"), "7");
    return responseFor(': heartbeat\r\n\r\nid: 8\r\nevent: delta\r\ndata: {"text":\r\ndata: "中文"}\r\n\r\nevent: done\ndata: {"status":"done"}');
  });
  const received: { event: string; data: string; id?: string }[] = [];
  await readSseStream("/test", { lastEventId: "7", onEvent: (event) => received.push(event) });
  assert.equal(received.length, 2);
  assert.equal(received[0].id, "8");
  assert.equal(JSON.parse(received[0].data).text, "中文");
  assert.equal(received[1].event, "done");
});

test("product stream dispatches reasoning and detects a truncated connection", async (t) => {
  t.mock.method(globalThis, "fetch", async () => responseFor('event: delta\ndata: {"reasoning":"分析","text":"正文"}\n\nevent: done\ndata: {"status":"done","duration_ms":20}\n\n'));
  let reasoning = ""; let content = ""; let done = false;
  await streamChatMessage("id", { onDelta: (delta) => { reasoning += delta.reasoning; content += delta.text; }, onDone: () => { done = true; } });
  assert.deepEqual([reasoning, content, done], ["分析", "正文", true]);
  t.mock.method(globalThis, "fetch", async () => responseFor('event: delta\ndata: {"text":"partial"}\n\n'));
  await assert.rejects(streamChatMessage("id", {}), /提前结束/);
});

test("HTTP checks status even if the body claims success, and keeps backend error details", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ code: 0, data: {} }, { status: 500 }));
  await assert.rejects(apiJson("/test"), (error: unknown) => error instanceof ApiError && error.status === 500);
  t.mock.method(globalThis, "fetch", async () => Response.json({ code: 20006, message: "附件已过期" }, { status: 404 }));
  await assert.rejects(apiJson("/test"), /附件已过期/);
});

test("history adapter restores the exact server answer, references, reasoning and stop state", () => {
  const turns = restoreTurns({ id: "s", title: "q", favorite: false, updated_at: 0, mode: "deep", model: "m", web_search: true,
    messages: [{ id: "m", question: "q", content: "partial", reasoning: "r", status: "stopped", references: [], followups: [], duration_ms: 123, warnings: ["truncated"], error: null, last_event_id: "9" }] });
  assert.equal(turns.length, 2);
  assert.equal(turns[0].content, "q");
  assert.deepEqual([turns[1].messageId, turns[1].content, turns[1].reasoning, turns[1].status, turns[1].warnings], ["m", "partial", "r", "stopped", ["truncated"]]);
});
