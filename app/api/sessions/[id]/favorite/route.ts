/**
 * PATCH /api/sessions/[id]/favorite
 * 切换会话的收藏状态（isFavorite 取反）
 *
 * 鉴权：getCurrentUserOrThrow
 */
import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id } = await params;

    // 先查会话是否存在且属于当前用户
    const session = await db.chatSession.findUnique({
      where: { id, userId: user.id },
      select: { isFavorite: true },
    });
    if (!session) {
      return NextResponse.json(
        { code: 404, message: "会话不存在", data: null },
        { status: 404 },
      );
    }

    const nextValue = !session.isFavorite;
    await db.chatSession.update({
      where: { id },
      data: { isFavorite: nextValue },
    });

    return NextResponse.json({
      code: 0,
      message: "ok",
      data: { isFavorite: nextValue },
    });
  } catch (err) {
    const code = (err as any)?.code;
    const status =
      code === "UNAUTHORIZED" ? 401 : code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      { code: status, message: (err as Error)?.message || "操作失败", data: null },
      { status },
    );
  }
}
