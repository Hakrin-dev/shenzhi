import { randomBytes } from "node:crypto";

import { createAuthMiddleware } from "better-auth/api";

import { REGISTRATION_EMAIL_SEND_OTP_PATH } from "../registration/constants";

/** 需要人机验证的 Better Auth 端点(发送验证码)。 */
export const TURNSTILE_SEND_OTP_PATH = "/email-otp/send-verification-otp";

/**
 * 匿名客户端标识 Cookie。只承载一个随机 id,用于在后端查找“已通过验证”状态;
 * “已验证”状态本身只保存在后端数据库,不写入前端 Cookie/localStorage。
 */
export const TURNSTILE_ANON_ID_COOKIE = "shenzhi_anon_id";

/** 在 before/after hooks 之间传递需要写回 Cookie 的匿名客户端 id。 */
export const TURNSTILE_CLIENT_ID_CONTEXT_KEY = "shenzhiTurnstileClientId";

/** 一次人机验证通过后,其他功能可复用的共享有效期(秒)。 */
export const TURNSTILE_VERIFIED_TTL_SECONDS = 15 * 60;

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
export function shouldEnforceTurnstile(
  path: string,
  enabled: boolean,
): boolean {
  return (
    enabled &&
    (path === TURNSTILE_SEND_OTP_PATH ||
      path === REGISTRATION_EMAIL_SEND_OTP_PATH)
  );
}

/** 生成一个随机匿名客户端 id。 */
export function createTurnstileClientId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * 依据部署的基础地址判断是否应下发 Secure Cookie。
 * 与 Better Auth 自身 Cookie 的 secure 判定保持一致(以 BETTER_AUTH_URL 的
 * 协议为准),避免 `next start`(production)下在 http://localhost 被浏览器拒绝。
 */
export function isSecureCookieBaseURL(baseURL: unknown): boolean {
  return typeof baseURL === "string" && baseURL.startsWith("https://");
}

/**
 * 在 after hook 写回匿名客户端 id Cookie。
 *
 * 必须在 after hook 写 Cookie:Better Auth 1.6.x 会用端点响应头替换 before
 * hook 的响应头;如果在 before hook 写入,浏览器收不到这枚 Cookie。
 * 这里只写匿名 id,不写任何“已验证”状态。
 */
export const persistTurnstileClientCookie = createAuthMiddleware(
  async (ctx) => {
    const clientId = (ctx as unknown as Record<string, unknown>)[
      TURNSTILE_CLIENT_ID_CONTEXT_KEY
    ];
    if (typeof clientId !== "string" || !clientId) return;

    ctx.setCookie(TURNSTILE_ANON_ID_COOKIE, clientId, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureCookieBaseURL(ctx.context.baseURL),
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  },
);
