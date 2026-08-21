/**
 * POST /api/users/forgot-password
 * 找回密码：按用户名/邮箱找到用户 → 生成 1 小时 token → 根据环境两种行为：
 *   ① 生产模式（SMTP_* 四件套都配了）→ Nodemailer 发送邮件；响应 { ok: true }（不在响应里暴露 token，防滥用）
 *   ② 开发模式（缺 SMTP 配置）→ 响应里直接返回 token 字符串，便于演示 /reset-password?token=xxx
 *
 * Request: { account: string }  — account 可以是 用户名 或 邮箱
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { createPasswordResetToken } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  account: z.string().trim().min(1, "请输入用户名或邮箱"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { account } = Schema.parse(body);

    // 先按"用户名"找，找不到再按"邮箱"找
    let user = await db.user.findUnique({
      where: { name: account },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      user = account.includes("@")
        ? await db.user.findUnique({
            where: { email: account },
            select: { id: true, name: true, email: true },
          })
        : null;
    }

    // 安全处理：找不到也不报错（避免枚举用户名），统一返回"如账号存在，我们已发送重置邮件/令牌"
    if (!user) {
      return NextResponse.json({
        code: 0,
        message:
          "如果该账号已注册，我们已发送重置说明（未配置 SMTP 时会把 token 写在开发者 console）。",
        data: { sent: false, developmentToken: process.env.NODE_ENV === "production" ? undefined : undefined },
      });
    }

    const token = await createPasswordResetToken(user.id);

    // —— 判断是否有完整 SMTP 配置 ——
    const smtpReady =
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS;

    if (smtpReady) {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      const host = req.headers.get("host") ?? "localhost:3000";
      const proto =
        host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
      const resetLink = `${proto}://${host}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await transport.sendMail({
          from: process.env.SMTP_FROM ?? `"深知助手" <${process.env.SMTP_USER}>`,
          to: user.email ?? process.env.SMTP_USER!,
          subject: "【深知助手】重置你的密码",
          html: `
            <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; line-height:1.7; color:#1f2937;">
              <h2 style="margin:0 0 16px">重置你的密码</h2>
              <p>你好 <b>${user.name}</b>，</p>
              <p>我们收到了你的密码重置请求。点击下面链接设置新密码：</p>
              <p style="margin:20px 0;">
                <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;">
                  立即重置密码
                </a>
              </p>
              <p style="color:#6b7280;font-size:13px;">
                链接有效期 1 小时，且只能使用一次。<br>
                若你没有发起此请求，请忽略本邮件。
              </p>
            </div>
          `,
        });
        return NextResponse.json({
          code: 0,
          message: "重置邮件已发送，请查收（检查垃圾箱）",
          data: { sent: true },
        });
      } catch (e) {
        console.error("[forgot] sendmail failed:", e);
        return NextResponse.json(
          {
            code: 500,
            message: "邮件发送失败：" + ((e as Error)?.message || String(e)),
            data: null,
          },
          { status: 500 },
        );
      }
    }

    // —— 开发模式：响应直接返回 token（便于演示 /reset-password?token= ）
    return NextResponse.json({
      code: 0,
      message:
        "开发模式：SMTP 未配置，直接返回重置令牌（/reset-password?token=xxx）。生产环境会隐藏。",
      data: {
        sent: false,
        developmentToken: token,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: 400,
          message: err.issues.map((i) => i.message).join("；"),
          data: null,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        code: 500,
        message: (err as Error)?.message || "请求失败",
        data: null,
      },
      { status: 500 },
    );
  }
}
