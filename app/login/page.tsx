"use client";

/**
 * /login 登录页（替代 NextAuth 默认 signin）
 * ------------------------------------------------------------------
 * 流程：前端调 NextAuth signIn("credentials", { name, password, redirect: false })
 *       → 命中 /api/auth/callback/credentials → auth.ts 中 Credentials.authorize()
 *       → 成功：返回 { ok, url } 手动 router.push(url 或 callbackUrl)
 *       → 失败：拿 auth error code 显示中文错误提示
 *
 * UPDATE: 2026-08-21 P1 用户系统 / Build 修复
 *  - useSearchParams 在 Next.js build 时要求上层必须有 Suspense boundary
 *    （否则抛出: useSearchParams should be wrapped in a Suspense boundary）
 *  - 这里直接在文件顶部用 <Suspense> 包装 <LoginPageInner /> 导出，
 *    不需要新增独立 loading.tsx（保持单文件可读）。
 */

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { signIn } from "next-auth/react";

function Field({
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <Input
        {...props}
        className={error ? "border-rose-400 focus-visible:ring-rose-400" : undefined}
      />
      {error && (
        <span className="text-[11.5px] text-rose-500">{error}</span>
      )}
    </label>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/agents/ask";
  const errorCode = params.get("error");

  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(
    errorCode ? nextAuthErrorToText(errorCode) : null,
  );
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError(null);
    // 本地字段校验（与 auth.ts LoginSchema 对齐，减少一次网络请求）
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = "用户名至少 2 个字符";
    if (name.trim().length > 32) errors.name = "用户名最多 32 个字符";
    if (password.length < 6) errors.password = "密码至少 6 个字符";
    if (password.length > 64) errors.password = "密码最多 64 个字符";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        name: name.trim(),
        password,
        redirect: false,
      });
      if (!res) throw new Error("登录服务无响应");
      if (res.error) {
        setGlobalError(nextAuthErrorToText(res.error));
        return;
      }
      // 成功 → 跳到 callbackUrl（默认 /agents/ask）
      router.replace(res.url || callbackUrl || "/agents/ask");
      router.refresh();
    } catch (err) {
      setGlobalError((err as Error)?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
        <div className="flex flex-col items-center gap-2">
          <Logo compact />
          <h1 className="flex items-center gap-1.5 text-base font-semibold text-ink">
            <Sparkles className="size-4 text-primary" />
            登录 深知
          </h1>
          <p className="text-xs text-muted">
            登录后同步你的对话历史、收藏与分享
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <Field
            label="用户名"
            placeholder="请输入用户名"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            required
          />
          <Field
            label="密码"
            type="password"
            placeholder="请输入密码"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
          />

          {globalError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
              {globalError}
            </div>
          )}

          <div className="flex items-center justify-between text-[12px] text-muted">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                defaultChecked
                className="size-3.5 rounded border-line text-primary"
              />
              记住我 7 天
            </label>
            <Link
              href="/reset-password"
              className="text-primary hover:underline"
            >
              忘记密码？
            </Link>
          </div>

          <Button
            className="w-full"
            type="submit"
            disabled={loading}
            size="default"
          >
            {loading ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <LogIn className="mr-1.5 size-4" />
            )}
            {loading ? "登录中…" : "登录"}
          </Button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-1 text-[12.5px] text-muted">
          <div>
            还没有账号？
            <Link
              href="/register"
              className="ml-1 font-medium text-primary hover:underline"
            >
              立即注册
            </Link>
          </div>
          <Link
            href="/"
            className="mt-0.5 text-[11.5px] text-faint hover:text-primary hover:underline"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 外层 Suspense：为内部 useSearchParams 提供 boundary（Next.js build 强制要求） */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
            <div className="flex flex-col items-center gap-2">
              <Logo compact />
              <div className="h-5 w-32 animate-pulse rounded bg-line" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="h-10 rounded-lg bg-line/60" />
              <div className="h-10 rounded-lg bg-line/60" />
            </div>
          </div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

/* -------- NextAuth credentials provider error code → 中文 -------- */
function nextAuthErrorToText(code: string): string {
  switch (code) {
    case "CredentialsSignin":
    case "InvalidCredentials":
      return "用户名或密码错误（请检查后重试）";
    case "UserNotFound":
      return "该用户名未注册，请先注册";
    case "WrongPassword":
      return "密码错误";
    case "Configuration":
      return "服务端配置异常（AUTH_SECRET 缺失？），请联系管理员";
    case "AccessDenied":
      return "登录被拒绝（账号可能被锁定）";
    case "Verification":
      return "登录令牌已失效，请重试";
    default:
      return `登录失败：${code}`;
  }
}
