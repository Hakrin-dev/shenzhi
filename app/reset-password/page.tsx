"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@/components/auth/auth-client";
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

  const handleRequestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setError("请输入邮箱");
      setNotice(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await authClient.requestPasswordReset({
        email: normalizedEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        setError(
          getAuthErrorMessage(
            result.error,
            EMAIL_PROVIDER_MESSAGE,
            "reset",
          ),
        );
        return;
      }

      setNotice("如果该邮箱存在，我们会发送重置邮件。");
    } catch (requestError) {
      setError(
        getAuthErrorMessage(requestError, EMAIL_PROVIDER_MESSAGE, "reset"),
      );
    } finally {
      setSubmitting(false);
    }
  };

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
              {submitting ? "发送中..." : "发送重置邮件"}
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

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={<div className="min-h-screen" aria-hidden="true" />}
    >
      <ResetPasswordContent />
    </React.Suspense>
  );
}
