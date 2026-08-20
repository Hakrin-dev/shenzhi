import { isTurnstileEnabled } from "@/config/turnstile";
import { REGISTRATION_EMAIL_SEND_OTP_PATH } from "../registration/constants";

/** 需要人机验证的 Better Auth 端点(发送验证码)。 */
export const TURNSTILE_SEND_OTP_PATH = "/email-otp/send-verification-otp";

/** 验证成功后下发的签名 Cookie: 后续发送验证码不再重复人机验证。 */
export const TURNSTILE_VERIFIED_COOKIE = "shenzhi_turnstile_verified";

const TURNSTILE_SITE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TURNSTILE_VERIFY_TIMEOUT_MS = 10_000;

interface TurnstileVerifyResult {
  success: boolean;
  action?: string;
  hostname?: string;
}

interface VerifyTurnstileTokenParams {
  token: string;
  secretKey: string;
  remoteIP?: string;
  expectedAction?: string;
  allowedHostnames?: string[];
}

/**
 * 向 Cloudflare 校验一次 Turnstile token;任何网络错误/超时都按失败处理
 * (fail closed)。
 */
export async function verifyCloudflareTurnstileToken(
  params: VerifyTurnstileTokenParams,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(TURNSTILE_SITE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: params.secretKey,
        response: params.token,
        ...(params.remoteIP ? { remoteip: params.remoteIP } : {}),
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as TurnstileVerifyResult;
    if (!data.success) return false;
    if (params.expectedAction && data.action !== params.expectedAction) {
      return false;
    }
    if (
      params.allowedHostnames?.length &&
      !(data.hostname && params.allowedHostnames.includes(data.hostname))
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/** 从请求头提取客户端 IP,作为 Turnstile 校验的可选加固信息。 */
export function getClientIP(request?: Request): string | undefined {
  if (!request) return undefined;

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

/** 是否需要在当前端点强制人机验证。 */
export function shouldEnforceTurnstile(path: string): boolean {
  return (
    isTurnstileEnabled() &&
    (path === TURNSTILE_SEND_OTP_PATH ||
      path === REGISTRATION_EMAIL_SEND_OTP_PATH)
  );
}
