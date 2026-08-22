"use client";

import * as React from "react";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileTheme = "auto" | "light" | "dark";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ) => string;
  remove: (widgetId: string) => void;
}

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  theme?: TurnstileTheme;
  size?: "normal" | "compact";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface CloudflareTurnstileProps {
  siteKey: string;
  action?: string;
  theme?: TurnstileTheme;
  /** 等比例放大 normal 尺寸组件(默认 1,1.5 表示放大 50%)。 */
  scale?: number;
  /** 用户完成人机验证后回调(带一次性 token)。 */
  onToken?: (token: string) => void;
  /** 脚本加载失败等异常回调。 */
  onError?: (error: unknown) => void;
}

let scriptLoadPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Cloudflare Turnstile is only available in the browser."),
    );
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Cloudflare Turnstile 初始化失败"));
    };
    script.onerror = () =>
      reject(new Error("Cloudflare Turnstile 脚本加载失败"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * 可见模式(managed)渲染的 Cloudflare Turnstile 组件。
 *
 * 只在需要验证时由父组件挂载;用户点击复选框通过后触发 `onToken`。
 * 组件本身不弹层,挑战以可见复选框形式呈现。
 */
export function CloudflareTurnstile({
  siteKey,
  action,
  theme = "auto",
  scale = 1,
  onToken,
  onError,
}: CloudflareTurnstileProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;

    (async () => {
      try {
        const turnstile = await loadTurnstile();
        if (cancelled || !containerRef.current) return;

        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          size: "normal",
          callback: (token) => {
            if (cancelled) return;
            onToken?.(token);
          },
          "error-callback": () => {
            if (cancelled) return;
            onError?.(new Error("人机验证失败"));
          },
        });
      } catch (error) {
        if (!cancelled) onError?.(error);
      }
    })();

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [siteKey, action, theme, onToken, onError]);

  return (
    <div style={scale !== 1 ? { zoom: scale } : undefined}>
      <div ref={containerRef} />
    </div>
  );
}
