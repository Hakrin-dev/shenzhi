/**
 * POST /api/users/reset-password
 * 重置密码：两种调用模式
 *   1. 未登录模式（找回密码流程）：Body 带 { token, newPassword }
 *      → verifyPasswordResetToken(token) 拿 userId → 改密
 *   2. 已登录模式（设置页 → 修改密码）：Session 已有 userId，Body 带 { oldPassword, newPassword }
 *      → resetPassword(loginRequired=true)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentUserOrThrow,
  resetPassword,
  verifyPasswordResetToken,
} from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 两种模式共享一个"新密码必填 6-64 字符"
const common = {
  newPassword: z
    .string()
    .min(6, "新密码至少 6 个字符")
    .max(64, "新密码最多 64 个字符"),
};

const ModeByToken = z.object({
  mode: z.literal("token"),
  token: z.string().trim().min(1, "重置令牌必填"),
  ...common,
});

const ModeByLogin = z.object({
  mode: z.literal("login"),
  oldPassword: z.string().min(6, "原密码至少 6 个字符"),
  ...common,
});

const Schema = z.discriminatedUnion("mode", [ModeByToken, ModeByLogin]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = Schema.parse(body);

    if (input.mode === "token") {
      // 模式1：token 找回 → 验证 → 重置
      const userId = await verifyPasswordResetToken(input.token);
      await resetPassword({ userId, newPassword: input.newPassword });
      return NextResponse.json({
        code: 0,
        message: "密码已重置，请登录",
        data: { redirect: "/login" },
      });
    }

    // 模式2：已登录改密（需要原密码校验）
    const user = await getCurrentUserOrThrow();
    await resetPassword({
      userId: user.id,
      oldPassword: input.oldPassword,
      newPassword: input.newPassword,
      loginRequired: true,
    });
    return NextResponse.json({
      code: 0,
      message: "密码已更新",
      data: null,
    });
  } catch (err) {
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
      code === "TOKEN_NOT_FOUND" || code === "TOKEN_USED" || code === "TOKEN_EXPIRED"
        ? 410
        : code === "OLD_PASSWORD_WRONG" || code === "OLD_PASSWORD_REQUIRED"
          ? 401
          : code === "USER_NOT_FOUND"
            ? 404
            : code === "UNAUTHORIZED"
              ? 401
              : 500;
    return NextResponse.json(
      {
        code: status,
        message: (err as Error)?.message || "重置失败",
        data: null,
      },
      { status },
    );
  }
}
