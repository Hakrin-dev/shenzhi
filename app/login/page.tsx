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
 *
 * UPDATE: 2026-08-24 UI 增强
 *  - 参考 dev 分支 login-modal 设计风格，统一使用设计系统 CSS 变量
 *  - 优化卡片阴影、间距、错误/成功提示样式
 *  - 增加入场动效与表单微交互
 */

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LogIn, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { signIn } from "next-auth/react";

/* ---------- 复用组件：表单字段 ---------- */
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
        className={cn(
          error &&
            "border-danger focus-visible:border-danger focus-visible:ring-danger/15",
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${props.id || props.name}-error` : undefined}
      />
      {error && (
        <span
          id={`${props.id || props.name}-error`}
          className="text-[12px] text-danger"
          role="alert"
        >
          {error}
        </span>
      )}
    </label>
  );
}

/* ---------- 登录页主体 ---------- */
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
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

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
      <div
        className={cn(
          "w-full max-w-sm rounded-2xl bg-card p-6 shadow-pop transition-all duration-500",
          mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        {/* 头部 */}
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

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Field
            label="用户名"
            name="name"
            placeholder="请输入用户名"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            disabled={loading}
            required
          />
          <Field
            label="密码"
            name="password"
            type="password"
            placeholder="请输入密码"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            disabled={loading}
            required
          />

          {/* 全局错误提示 */}
          {globalError && (
            <div
              className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13px] leading-5 text-danger"
              role="alert"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-current">
                <span className="text-[10px] font-bold">!</span>
              </span>
              <span>{globalError}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[12px] text-muted">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                defaultChecked
                className="size-3.5 rounded border-line text-primary"
                disabled={loading}
              />
              记住我 7 天
            </label>
            <Link
              href="/reset-password"
              className="text-[13px] font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              aria-disabled={loading}
              onClick={(e) => {
                if (loading) e.preventDefault();
              }}
            >
              忘记密码？
            </Link>
          </div>

          <Button
            className="w-full"
            type="submit"
            disabled={loading}
            aria-busy={loading}
            size="default"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            )}
            {loading ? "登录中…" : "登录"}
          </Button>
        </form>

        {/* 分隔线 + 其他方式 */}
        <div className="mt-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-faint">或使用以下方式</span>
            <div className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-3 flex justify-center">
            <span className="rounded-full border border-dashed border-line px-3 py-1 text-[11px] text-faint">
              更多登录方式即将上线
            </span>
          </div>
        </div>

        {/* 底部链接 */}
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
            href="/agents/ask"
            className="mt-0.5 text-[11.5px] text-faint hover:text-primary hover:underline"
          >
            ← 返回 AI 助手
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
              <div className="h-10 rounded-xl bg-line/60" />
              <div className="h-10 rounded-xl bg-line/60" />
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
