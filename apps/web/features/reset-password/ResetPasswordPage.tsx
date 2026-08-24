"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@/components/auth/auth-client";
import { CloudflareTurnstile } from "@/components/auth/turnstile";
import {
  EMAIL_PROVIDER_MESSAGE,
  getAuthErrorMessage,
  PASSWORD_POLICY_MESSAGE,
} from "@/components/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/policies/password";
import { Logo } from "@/components/layout/logo";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function Field({
  label,
  ...props
}: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <Input {...props} />
    </label>
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function errorCodeOf(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

type SendResetResult = "sent" | "captcha-required" | "error";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidToken = searchParams.get("error") === "INVALID_TOKEN";
  const [email, setEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(
    invalidToken ? "重置链接已失效，请重新申请" : null,
  );
  const [notice, setNotice] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [showTurnstile, setShowTurnstile] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const pendingEmailRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendResetEmail = React.useCallback(
    async (
      resetEmail: string,
      turnstileToken?: string,
    ): Promise<SendResetResult> => {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      try {
        const result = await authClient.requestPasswordReset(
          {
            email: resetEmail,
            redirectTo: `${window.location.origin}/reset-password`,
          },
          turnstileToken
            ? { headers: { "x-captcha-response": turnstileToken } }
            : {},
        );

        if (result.error) {
          if (
            !turnstileToken &&
            (errorCodeOf(result.error) === "MISSING_RESPONSE" ||
              errorCodeOf(result.error) === "VERIFICATION_FAILED")
          ) {
            return "captcha-required";
          }

          setError(
            getAuthErrorMessage(
              result.error,
              EMAIL_PROVIDER_MESSAGE,
              "reset",
            ),
          );
          return "error";
        }

        setCooldown(60);
        setNotice("如果该邮箱存在，我们会发送重置邮件。");
        return "sent";
      } catch (requestError) {
        setError(
          getAuthErrorMessage(requestError, EMAIL_PROVIDER_MESSAGE, "reset"),
        );
        return "error";
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const handleRequestReset = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setError("请输入邮箱");
      setNotice(null);
      return;
    }
    if (cooldown > 0) return;

    // 先不带 token 尝试发送;后端若判定需要人机验证则弹出 Turnstile。
    const result = await sendResetEmail(normalizedEmail);
    if (result === "captcha-required") {
      pendingEmailRef.current = normalizedEmail;
      setShowTurnstile(true);
      setNotice("请先完成上方人机验证");
    }
  };

  const handleTurnstileToken = React.useCallback(
    async (token: string) => {
      setShowTurnstile(false);
      setNotice(null);

      const resetEmail = pendingEmailRef.current;
      pendingEmailRef.current = null;
      if (!resetEmail) return;

      await sendResetEmail(resetEmail, token);
    },
    [sendResetEmail],
  );

  const handleTurnstileError = React.useCallback(() => {
    setShowTurnstile(false);
    setError("人机验证失败，请重试");
  }, []);

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("重置链接无效，请重新申请");
      return;
    }
    if (!validatePasswordPolicy(newPassword).valid) {
      setError(PASSWORD_POLICY_MESSAGE);
      setNotice(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      setNotice(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (result.error) {
        setError(
          getAuthErrorMessage(
            result.error,
            "密码重置失败，请重新申请重置链接",
            "reset",
          ),
        );
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setNotice("密码已重置，请使用新密码登录。");
    } catch (resetError) {
      setError(
        getAuthErrorMessage(
          resetError,
          "密码重置失败，请重新申请重置链接",
          "reset",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isResetMode = Boolean(token);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
        <div className="flex flex-col items-center gap-2">
          <Logo compact />
          <h1 className="text-base font-semibold text-ink">
            {isResetMode ? "重置密码" : "找回密码"}
          </h1>
          <p className="text-xs text-muted">
            {isResetMode
              ? "设置一个新的登录密码"
              : "输入邮箱后，我们会发送密码重置链接"}
          </p>
        </div>

        {isResetMode ? (
          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={handleResetPassword}
            noValidate
          >
            <Field
              label="新密码"
              type="password"
              placeholder="请输入新密码"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="-mt-2 text-xs text-muted">{PASSWORD_POLICY_MESSAGE}</p>
            <Field
              label="确认新密码"
              type="password"
              placeholder="请再次输入新密码"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {error && (
              <p className="text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-[13px] text-muted" role="status">
                {notice}
              </p>
            )}
            <Button type="submit" className="mt-1 w-full" disabled={submitting}>
              {submitting ? "重置中..." : "重置密码"}
            </Button>
          </form>
        ) : (
          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={handleRequestReset}
            noValidate
          >
            <Field
              label="邮箱"
              type="email"
              placeholder="请输入邮箱"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {showTurnstile && TURNSTILE_SITE_KEY && (
              <CloudflareTurnstile
                siteKey={TURNSTILE_SITE_KEY}
                onToken={handleTurnstileToken}
                onError={handleTurnstileError}
              />
            )}
            {error && (
              <p className="text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-[13px] text-muted" role="status">
                {notice}
              </p>
            )}
            <Button
              type="submit"
              className="mt-1 w-full"
              disabled={submitting || cooldown > 0}
              aria-busy={submitting}
            >
              {submitting
                ? "发送中..."
                : cooldown > 0
                  ? `${cooldown}s后重发`
                  : "发送重置邮件"}
            </Button>
          </form>
        )}

        <div className="mt-4 flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" />
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={<div className="min-h-screen" aria-hidden="true" />}
    >
      <ResetPasswordContent />
    </React.Suspense>
  );
}
