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
 * 进入页面先询问后端是否已在 15 分钟内通过验证;已通过则直接跳转 GitHub
 * 授权页,否则只显示一个 Cloudflare Turnstile 组件,完成后自动发送 token。
 */
export function GithubVerifyPage() {
  // 后端要求先做人机验证时才显示验证框。
  const [needsChallenge, setNeedsChallenge] = React.useState(false);
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

      setNeedsChallenge(true);
      setAttempt((value) => value + 1);
    } catch {
      setNeedsChallenge(true);
      setAttempt((value) => value + 1);
    } finally {
      submittedRef.current = false;
    }
  }, []);

  // 挂载时先询问后端是否已通过验证,已通过则自动进入 GitHub 授权页。
  React.useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/auth/github/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        const data = (await response.json().catch(() => null)) as VerifyResponse | null;

        if (cancelled) return;
        if (response.ok && data?.url) {
          window.location.assign(data.url);
          return;
        }

        setNeedsChallenge(true);
      } catch {
        if (!cancelled) setNeedsChallenge(true);
      }
    })();

    return () => {
      cancelled = true;
    };
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
      {needsChallenge && (
        <CloudflareTurnstile
          key={attempt}
          siteKey={TURNSTILE_SITE_KEY}
          scale={1.5}
          onToken={handleToken}
          onError={handleError}
        />
      )}
    </main>
  );
}
