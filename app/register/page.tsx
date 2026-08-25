"use client";

/**
 * /register 注册页
 * ------------------------------------------------------------------
 * 流程：
 *   1. 本地按 RegisterSchema 做字段校验
 *   2. POST /api/users/register → auth.ts registerUser → bcrypt hash → 写 User 表
 *   3. 成功 → 后端自动 signIn Credentials → 返回 redirect url
 *   4. 前端跳到 /agents/ask（已登录）
 *
 * UPDATE: 2026-08-24 UI 增强
 *  - 参考 dev 分支 login-modal 设计风格，统一使用设计系统 CSS 变量
 *  - 优化卡片阴影、间距、错误/成功提示样式
 *  - 增加入场动效与表单微交互
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles, UserPlus2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";

/* ---------- 复用组件：表单字段 ---------- */
function Field({
  label,
  error,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: string;
}) {
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
        aria-describedby={
          error
            ? `${props.id || props.name}-error`
            : hint
              ? `${props.id || props.name}-hint`
              : undefined
        }
      />
      {hint && !error && (
        <span
          id={`${props.id || props.name}-hint`}
          className="text-[11px] text-faint"
        >
          {hint}
        </span>
      )}
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

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError(null);
    // 与 auth.ts RegisterSchema 同规则（重复一份在 client 省一次 HTTP 400）
    const errors: Record<string, string> = {};
    if (!/^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/.test(form.name.trim()) || form.name.trim().length < 2 || form.name.trim().length > 32) {
      errors.name = "2-32 位，支持字母 / 数字 / 中文 / 下划线 / 短横线";
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errors.email = "邮箱格式不正确";
    }
    if (form.email.length > 128) errors.email = "邮箱最多 128 字符";
    if (form.password.length < 6 || form.password.length > 64)
      errors.password = "密码 6-64 个字符";
    if (form.confirm !== form.password) errors.confirm = "两次输入的密码不一致";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          password: form.password,
          confirm: form.confirm,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        code?: number;
        message?: string;
        data?: { redirect?: string };
      };
      if (!resp.ok || data.code !== 0) {
        // NAME_TAKEN / EMAIL_TAKEN → 标红对应字段
        const code = (data as any)?.code;
        if (resp.status === 409 && /用户名|NAME_TAKEN/.test(data.message || "")) {
          setFieldErrors({ name: "该用户名已被注册，换一个试试" });
        } else if (resp.status === 409 && /邮箱|EMAIL_TAKEN/.test(data.message || "")) {
          setFieldErrors({ email: "该邮箱已被注册" });
        } else {
          setGlobalError(data.message || "注册失败");
        }
        return;
      }
      // 成功：后端已自动登录 → 跳 redirect
      router.replace(data.data?.redirect || "/agents/ask");
      router.refresh();
    } catch (err) {
      setGlobalError((err as Error)?.message || "注册失败，请检查网络");
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
            创建 深知 账号
          </h1>
          <p className="text-xs text-muted">
            原型环境 · 你的账号保存在本机 SQLite，完全离线安全
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Field
            label="用户名（登录唯一凭证）"
            name="name"
            placeholder="例如：shenzhi_2026"
            autoComplete="username"
            value={form.name}
            onChange={onChange("name")}
            error={fieldErrors.name}
            hint="2-32 位，用于登录"
            disabled={loading}
            required
          />
          <Field
            label="邮箱（找回密码用，可留空）"
            name="email"
            type="email"
            placeholder="your@email.com（可选）"
            autoComplete="email"
            value={form.email}
            onChange={onChange("email")}
            error={fieldErrors.email}
            hint="未配置 SMTP 时也能在响应里拿到重置 token（开发模式）"
            disabled={loading}
          />
          <Field
            label="密码"
            name="password"
            type="password"
            placeholder="至少 6 个字符"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange("password")}
            error={fieldErrors.password}
            disabled={loading}
            required
          />
          <Field
            label="确认密码"
            name="confirm"
            type="password"
            placeholder="再次输入相同密码"
            autoComplete="new-password"
            value={form.confirm}
            onChange={onChange("confirm")}
            error={fieldErrors.confirm}
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

          <Button
            className="w-full"
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus2 className="size-4" aria-hidden="true" />
            )}
            {loading ? "创建账号中…" : "创建账号并登录"}
          </Button>
        </form>

        {/* 底部链接 */}
        <div className="mt-5 flex flex-col items-center gap-1 text-[12.5px] text-muted">
          <div>
            已有账号？
            <Link
              href="/login"
              className="ml-1 font-medium text-primary hover:underline"
            >
              直接登录
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
