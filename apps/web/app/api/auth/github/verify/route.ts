import { NextRequest, NextResponse } from "next/server";

import { githubOAuthConfigured } from "@/config/oauth";
import { isTurnstileEnabled, turnstileConfig } from "@/config/turnstile";
import {
  getClientIP,
  verifyCloudflareTurnstileToken,
} from "@/lib/auth/captcha/turnstile";
import { auth } from "@/lib/auth/server";

const GITHUB_PROVIDER = "github";

function errorResponse(message: string, code: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}

/**
 * 从 Better Auth 返回的响应头中提取 Set-Cookie。
 * `Headers.getSetCookie()` 在 Node 18.14+ 可用,旧运行时回退为单值读取。
 */
function extractSetCookies(headers: Headers | undefined): string[] {
  if (!headers) return [];

  const getSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  if (typeof getSetCookie === "function") return getSetCookie.call(headers);

  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

/**
 * GitHub 登录的跳转式人机验证入口。
 *
 * 浏览器完成 Turnstile 后把一次性 token POST 到这里;校验通过后,本端点调用
 * Better Auth 的 `/sign-in/social` 生成授权 URL 与 OAuth state Cookie,并把两者
 * 返回给前端,由前端跳转到 GitHub 授权页。
 */
export async function POST(request: NextRequest) {
  if (!githubOAuthConfigured) {
    return errorResponse("GitHub 登录未配置", "oauth_not_configured", 503);
  }

  let token: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      token?: unknown;
    } | null;
    token = typeof body?.token === "string" ? body.token.trim() : null;
  } else {
    const formData = await request.formData().catch(() => null);
    const value = formData?.get("token");
    token = typeof value === "string" ? value.trim() : null;
  }

  if (isTurnstileEnabled()) {
    const secretKey = turnstileConfig.secretKey;
    if (!secretKey) {
      return errorResponse("人机验证未配置", "turnstile_not_configured", 503);
    }

    if (!token) {
      return errorResponse(
        "缺少人机验证凭证",
        "missing_captcha_response",
        400,
      );
    }

    const valid = await verifyCloudflareTurnstileToken({
      token,
      secretKey,
      remoteIP: getClientIP(request),
      expectedAction: turnstileConfig.expectedAction,
      allowedHostnames: turnstileConfig.allowedHostnames,
    });

    if (!valid) {
      return errorResponse("人机验证失败，请重试", "verification_failed", 400);
    }
  }

  try {
    const result = await auth.api.signInSocial({
      body: {
        provider: GITHUB_PROVIDER,
        callbackURL: "/",
        disableRedirect: true,
      },
      returnHeaders: true,
      returnStatus: true,
    });

    const url = result.response?.url;
    if (!url) {
      return errorResponse(
        "无法创建 GitHub 登录链接",
        "oauth_init_failed",
        500,
      );
    }

    const response = NextResponse.json({ url });
    for (const cookie of extractSetCookies(result.headers)) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch {
    return errorResponse("无法创建 GitHub 登录链接", "oauth_init_failed", 500);
  }
}
