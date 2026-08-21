/**
 * /api/sessions/[id]
 * GET    : 单会话详情（含 composer 快照 model/style/webSearch/attachments）
 * PATCH  : 改标题（校验 ownerId）
 * DELETE : 软删（写 deletedAt），校验 ownerId
 *
 * 越权保护：所有查询都带 userId 条件；查不到 → 403（不区分"不存在"与"属于他人"，避免泄露存在性）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserOrThrow } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(200, "标题最多 200 字"),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id } = await params;
    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: {
        id: true,
        title: true,
        model: true,
        style: true,
        webSearch: true,
        attachments: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!session) throw forbidden();
    return NextResponse.json({ code: 0, message: "ok", data: session });
  } catch (err) {
    return errToResponse(err, "获取会话详情失败");
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = PatchSchema.parse(body);

    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!session) throw forbidden();

    const updated = await db.chatSession.update({
      where: { id },
      data: { title: input.title },
      select: { id: true, title: true, updatedAt: true },
    });
    return NextResponse.json({ code: 0, message: "ok", data: updated });
  } catch (err) {
    return errToResponse(err, "重命名失败");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id } = await params;
    const session = await db.chatSession.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!session) throw forbidden();

    await db.chatSession.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ code: 0, message: "ok", data: { id } });
  } catch (err) {
    return errToResponse(err, "删除会话失败");
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
