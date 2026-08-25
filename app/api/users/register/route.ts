/**
 * POST /api/users/register
 * 注册：校验 RegisterSchema → bcrypt.hash → 写入 User 表 → 自动登录（调用 NextAuth signIn Credentials）
 *
 * Request Body: { name, email?, password, confirm }
 * Response: ApiEnvelope<{ redirect: string }>  — 前端根据 redirect 跳 /agents/ask
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RegisterSchema, registerUser, signIn } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = RegisterSchema.parse(body);
    // 注册（内部已做 用户名/邮箱 唯一校验）
    const user = await registerUser(input);
    // 注册成功 → 自动登录（Credentials Provider 不走表单 POST，走编程式 signIn）
    // 注意：NextAuth signIn 在 server action 场景会 302 重定向，
    // 但我们在 route handler 里调用要控制响应格式，所以 redirect=false 取到 url 自行返回
    const r = (await signIn("credentials", {
      name: input.name,
      password: input.password,
      redirect: false,
    })) as { url?: string; error?: string };
    if (r?.error) {
      return NextResponse.json(
        { code: 401, message: `注册成功但自动登录失败：${r.error}`, data: { userId: user.id } },
        { status: 401 },
      );
    }
    return NextResponse.json({
      code: 0,
      message: "注册成功",
      data: { userId: user.id, redirect: r?.url ?? "/agents/ask" },
    });
  } catch (err) {
    if (err instanceof ZodError) {
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
      code === "NAME_TAKEN" || code === "EMAIL_TAKEN" ? 409 : 500;
    return NextResponse.json(
      {
        code: status,
        message: (err as Error)?.message || "注册失败",
        data: null,
      },
      { status },
    );
  }
}
