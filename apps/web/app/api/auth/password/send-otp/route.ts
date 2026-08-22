import { NextRequest, NextResponse } from "next/server";

import { emailDeliveryConfigured } from "@/config/email";
import { auth } from "@/lib/auth/server";
import { createBetterAuthEmailCallbacks } from "@/lib/auth/email/callbacks";
import {
  generateSetPasswordOtp,
  hashSetPasswordOtp,
  SET_PASSWORD_OTP_EXPIRES_IN_SECONDS,
  setPasswordOtpIdentifier,
} from "@/lib/auth/password/otp";
import { createAuthEmailProvider } from "@/lib/auth/providers/email";

/**
 * 向当前登录用户自己的邮箱发送「设置密码」验证码。
 *
 * 该端点要求已登录（会话绑定本人邮箱），因此无需人机验证；
 * 验证码只发给当前会话所属账号的邮箱。
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;
  if (!user?.id || !user.email) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "请先登录" },
      { status: 401 },
    );
  }

  if (!emailDeliveryConfigured) {
    return NextResponse.json(
      {
        error: "EMAIL_PROVIDER_NOT_CONFIGURED",
        message: "邮件服务尚未配置，暂时无法发送邮件",
      },
      { status: 503 },
    );
  }

  const ctx = await auth.$context;
  const otp = generateSetPasswordOtp();
  const identifier = setPasswordOtpIdentifier(user.id);
  const otpHash = await hashSetPasswordOtp(user.id, otp, ctx.secret);

  await ctx.internalAdapter.createVerificationValue({
    identifier,
    value: JSON.stringify({ otpHash, attempts: 0 }),
    expiresAt: new Date(
      Date.now() + SET_PASSWORD_OTP_EXPIRES_IN_SECONDS * 1000,
    ),
  });

  const emailCallbacks = createBetterAuthEmailCallbacks(
    createAuthEmailProvider(),
  );
  await emailCallbacks.sendVerificationOTP({
    email: user.email,
    otp,
    type: "set-password",
  });

  return NextResponse.json({ success: true });
}
