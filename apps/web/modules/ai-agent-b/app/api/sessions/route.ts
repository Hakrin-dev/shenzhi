/**
 * /api/sessions
 * GET  : 当前用户最近 20 条会话（不含 messages 全文，含 messageCount）
 * POST : 新建会话（可选 title + composer 快照）→ 返回 { id }
 *
 * 鉴权：全部走 getCurrentUserOrThrow（未登录 → 401）。
 * 匿名态兼容见 spec Task 13：匿名用户前端用 localStorage 临时兜底，不写库。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserOrThrow } from "@b/lib/auth-bridge";
import { db } from "@b/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 新建会话的 composer 快照（回灌用） */
const CreateSessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
  model: z.string().optional(),
  style: z.string().optional(),
  webSearch: z.boolean().optional(),
  attachments: z.array(z.any()).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const sessions = await db.chatSession.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        model: true,
        style: true,
        webSearch: true,
        attachments: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    const data = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      model: s.model,
      style: s.style,
      webSearch: s.webSearch,
      attachments: s.attachments,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages,
    }));
    return NextResponse.json({ code: 0, message: "ok", data });
  } catch (err) {
    return errToResponse(err, "获取会话列表失败");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = await req.json().catch(() => ({}));
    const input = CreateSessionSchema.parse(body);
    const session = await db.chatSession.create({
      data: {
        userId: user.id,
        title: input.title || "新的对话",
        model: input.model || "default",
        style: input.style || "deep",
        webSearch: input.webSearch ?? false,
        // SQLite Json 无默认值：应用层传空数组
        attachments: (input.attachments ?? []) as unknown as object,
      },
      select: { id: true },
    });
    return NextResponse.json({ code: 0, message: "ok", data: { id: session.id } });
  } catch (err) {
    return errToResponse(err, "新建会话失败");
  }
}

/** 统一错误 → ApiEnvelope（对齐 /api/users/* 的响应形状） */
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
    (err as { status?: number })?.status === 401 ||
    code === "UNAUTHORIZED"
      ? 401
      : code === "NOT_FOUND"
        ? 404
        : code === "FORBIDDEN"
          ? 403
          : 500;
  return NextResponse.json(
    { code: status, message: (err as Error)?.message || fallback, data: null },
    { status },
  );
}
