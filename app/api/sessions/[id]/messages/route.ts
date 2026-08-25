/**
 * /api/sessions/[id]/messages
 * GET  : 拉单会话全部消息（含 content + sources + thinkingContent）供回灌
 * POST : 追加一条消息（role=user|assistant）—— 客户端兜底写入路径；
 *        主要写入走 /api/ai/chat 服务端（Task 15），此处作为降级兜底。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserOrThrow } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  thinkingContent: z.string().optional(),
  sources: z.array(z.any()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id } = await params;
    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!session) throw forbidden();

    const messages = await db.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        thinkingContent: true,
        sources: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ code: 0, message: "ok", data: messages });
  } catch (err) {
    return errToResponse(err, "获取消息失败");
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = CreateMessageSchema.parse(body);

    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!session) throw forbidden();

    const msg = await db.chatMessage.create({
      data: {
        sessionId: id,
        role: input.role,
        content: input.content,
        thinkingContent: input.thinkingContent ?? null,
        sources: (input.sources ?? []) as unknown as object,
      },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ code: 0, message: "ok", data: msg });
  } catch (err) {
    return errToResponse(err, "写入消息失败");
  }
}

function forbidden() {
  const e = new Error("无权操作该会话或会话不存在");
  (e as any).code = "FORBIDDEN";
  return e;
}

function errToResponse(err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      {
        code: 400,
        message: err.issues.map((i) => `${i.path.join(".") || "字段"}：${i.message}`).join("；"),
        data: null,
      },
      { status: 400 },
    );
  }
  const code = (err as any)?.code;
  const status =
    code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 500;
  return NextResponse.json(
    { code: status, message: (err as Error)?.message || fallback, data: null },
    { status },
  );
}
