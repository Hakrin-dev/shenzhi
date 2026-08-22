"use client";

import * as React from "react";
import { CloudflareTurnstile } from "@/components/auth/turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type VerifyResponse = {
  url?: string;
};

/**
 * GitHub 登录前的独立人机验证页。
 *
 * 页面只呈现 Cloudflare Turnstile 组件,完成验证后自动向后端发送 token;
 * 后端校验通过后返回 GitHub 授权地址并跳转,失败则重置组件供重新验证。
 */
export function GithubVerifyPage() {
  // 验证失败后自增,强制重新挂载 Turnstile 组件以便再次验证。
  const [attempt, setAttempt] = React.useState(0);
  const submittedRef = React.useRef(false);

  const verify = React.useCallback(async (captchaToken: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    try {
      const response = await fetch("/api/auth/github/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: captchaToken }),
      });

      const data = (await response.json().catch(() => null)) as VerifyResponse | null;

      if (response.ok && data?.url) {
        window.location.assign(data.url);
        return;
      }

      setAttempt((value) => value + 1);
    } catch {
      setAttempt((value) => value + 1);
    } finally {
      submittedRef.current = false;
    }
  }, []);

  const handleToken = React.useCallback(
    (nextToken: string) => {
      void verify(nextToken);
    },
    [verify],
  );

  const handleError = React.useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  if (!TURNSTILE_SITE_KEY) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <p className="text-[13px] text-danger" role="alert">
          人机验证未配置，暂时无法使用 GitHub 登录。
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <CloudflareTurnstile
        key={attempt}
        siteKey={TURNSTILE_SITE_KEY}
        scale={1.5}
        onToken={handleToken}
        onError={handleError}
      />
    </main>
  );
}
