"use client";

/**
 * /reset-password 找回密码页（第二阶段 P1 真实逻辑版）
 * ------------------------------------------------------------------
 * 两步骤流程：
 *  Step 1（?token= 不存在）：输入账号（用户名/邮箱）→ POST /api/users/forgot-password
 *          - SMTP 配了 → 发邮件 → 提示查收
 *          - SMTP 未配（开发模式）→ 直接返回 token → 页面跳 /reset-password?token=xxx
 *  Step 2（?token=xxx）：输入两次新密码 → POST /api/users/reset-password (mode=token)
 *          - 成功 → 跳 /login
 *
 *  复用旧 UI 框架，但替换内容为真实 fetch + 状态机。
 *
 * UPDATE: 2026-08-21 P1 用户系统 / Build 修复
 *  - 同 login：useSearchParams 必须包 Suspense boundary
 *
 * UPDATE: 2026-08-24 UI 增强
 *  - 参考 dev 分支 ResetPasswordPage 设计风格，统一使用设计系统 CSS 变量
 *  - 优化卡片阴影、间距、错误/成功提示样式
 *  - 增加入场动效与表单微交互
 */

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";

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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
            <div className="flex flex-col items-center gap-2">
              <Logo compact />
              <div className="h-5 w-28 animate-pulse rounded bg-line" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="h-10 rounded-xl bg-line/60" />
              <div className="h-10 rounded-xl bg-line/60" />
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenFromUrl = params.get("token");

  const hasToken = Boolean(tokenFromUrl);
  const [account, setAccount] = React.useState("");
  const [pwd1, setPwd1] = React.useState("");
  const [pwd2, setPwd2] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  // 开发模式：接口直接返回 token → 存在此状态里并在下一步显示"点此跳转"
  const [devToken, setDevToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const step1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);
    setSuccess(null);
    setDevToken(null);
    if (!account.trim()) {
      setErrors({ account: "请输入用户名或邮箱" });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/users/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: account.trim() }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        code?: number;
        message?: string;
        data?: { developmentToken?: string; sent?: boolean };
      };
      if (!resp.ok || data.code !== 0) {
        setGlobalError(data.message || "请求失败");
        return;
      }
      if (data.data?.developmentToken) {
        setDevToken(data.data.developmentToken);
        setSuccess(
          data.message ||
            "开发模式：已生成重置令牌，点击下方按钮直接进入改密页（生产环境会隐藏此 token）。",
        );
      } else {
        setSuccess(data.message || "重置说明已发送，如果账号存在请查收邮件（垃圾箱）");
      }
    } catch (err) {
      setGlobalError((err as Error)?.message || "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const step2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);
    setSuccess(null);
    const errs: Record<string, string> = {};
    if (pwd1.length < 6) errs.pwd1 = "新密码至少 6 个字符";
    if (pwd1.length > 64) errs.pwd1 = "新密码最多 64 个字符";
    if (pwd2 !== pwd1) errs.pwd2 = "两次输入的密码不一致";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "token",
          token: tokenFromUrl!,
          newPassword: pwd1,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        code?: number;
        message?: string;
        data?: { redirect?: string };
      };
      if (!resp.ok || data.code !== 0) {
        // 令牌相关错误 → 统一提示
        if (
          data.code === 410 ||
          /TOKEN_NOT_FOUND|TOKEN_USED|TOKEN_EXPIRED/.test(data.message || "")
        ) {
          setGlobalError(
            `${data.message || "重置链接已失效"}。请重新发起找回密码。`,
          );
        } else {
          setGlobalError(data.message || "重置失败");
        }
        return;
      }
      setSuccess("密码已重置成功，即将跳转到登录…");
      setTimeout(() => {
        router.replace(data.data?.redirect || "/login");
      }, 1200);
    } catch (err) {
      setGlobalError((err as Error)?.message || "请求失败");
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
          <h1 className="text-base font-semibold text-ink">
            {hasToken ? "设置新密码" : "找回密码"}
          </h1>
          <p className="text-xs text-muted">
            {hasToken
              ? "请输入两次新密码，提交后生效"
              : "输入账号名或邮箱，获取重置链接"}
          </p>
        </div>

        {/* Step 1：发起找回 */}
        {!hasToken && (
          <form onSubmit={step1Submit} className="mt-6 flex flex-col gap-4" noValidate>
            <Field
              label="用户名或邮箱"
              name="account"
              placeholder="请输入注册时的用户名或邮箱"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              error={errors.account}
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

            {/* 成功提示 */}
            {success && !devToken && (
              <div
                className="flex items-start gap-2 rounded-xl border border-success/20 bg-success-soft px-3 py-2.5 text-[13px] leading-5 text-success"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{success}</span>
              </div>
            )}

            {/* 开发模式令牌 */}
            {devToken && (
              <div className="rounded-xl border border-line bg-panel p-3 text-[12.5px] text-ink-2">
                <div className="flex items-center gap-1.5 font-medium text-ink-2">
                  <Mail className="size-3.5" aria-hidden="true" />
                  开发模式专属 · 拿到临时令牌
                </div>
                <p className="mt-1 break-all font-mono text-[11.5px] text-muted">
                  token = {devToken}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    router.replace(`/reset-password?token=${encodeURIComponent(devToken)}`)
                  }
                  disabled={loading}
                >
                  进入设置新密码 →
                </Button>
              </div>
            )}

            <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="size-4" aria-hidden="true" />
              )}
              {loading ? "发送中…" : "发送重置链接"}
            </Button>
          </form>
        )}

        {/* Step 2：输入新密码 */}
        {hasToken && (
          <form onSubmit={step2Submit} className="mt-6 flex flex-col gap-4" noValidate>
            <Field
              label="新密码"
              name="pwd1"
              type="password"
              placeholder="至少 6 个字符"
              autoComplete="new-password"
              value={pwd1}
              onChange={(e) => setPwd1(e.target.value)}
              error={errors.pwd1}
              disabled={loading}
              required
            />
            <Field
              label="再次输入新密码"
              name="pwd2"
              type="password"
              placeholder="与上面一致"
              autoComplete="new-password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              error={errors.pwd2}
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

            {/* 成功提示 */}
            {success && (
              <div
                className="flex items-start gap-2 rounded-xl border border-success/20 bg-success-soft px-3 py-2.5 text-[13px] leading-5 text-success"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{success}</span>
              </div>
            )}

            <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {loading ? "提交中…" : "重置密码"}
            </Button>
          </form>
        )}

        {/* 底部返回 */}
        <div className="mt-4 flex justify-center">
          <Link
            href="/login"
            className="flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}
