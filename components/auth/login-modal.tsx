"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { authClient } from "@/components/auth/auth-client";
import {
  getAuthErrorMessage,
  PASSWORD_POLICY_MESSAGE,
} from "@/components/auth/auth-errors";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/policies/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

type LoginTab = "password" | "code" | "register";
type Submission = "login" | "otp-send" | "otp-login" | "register" | null;

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

export function LoginModal({ open, onClose }: LoginModalProps) {
  const { refetch: refetchSession } = authClient.useSession();
  const [tab, setTab] = React.useState<LoginTab>("password");
  const [submission, setSubmission] = React.useState<Submission>(null);

  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [codeEmail, setCodeEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [codeNotice, setCodeNotice] = React.useState<string | null>(null);
  const [codeCooldown, setCodeCooldown] = React.useState(0);

  const [registerName, setRegisterName] = React.useState("");
  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] =
    React.useState("");
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [registerNotice, setRegisterNotice] = React.useState<string | null>(
    null,
  );

  const resetForm = React.useCallback(() => {
    setTab("password");
    setSubmission(null);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setCodeEmail("");
    setCode("");
    setCodeError(null);
    setCodeNotice(null);
    setCodeCooldown(0);
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterPasswordConfirm("");
    setRegisterError(null);
    setRegisterNotice(null);
  }, []);

  const handleClose = React.useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submission) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose, submission]);

  React.useEffect(() => {
    if (codeCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCodeCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [codeCooldown]);

  const handleTabChange = (value: string) => {
    if (submission) return;
    setTab(value as LoginTab);
    setLoginError(null);
    setCodeError(null);
    setCodeNotice(null);
    setRegisterError(null);
    setRegisterNotice(null);
  };

  const handleSendOtp = async () => {
    setCodeError(null);
    setCodeNotice(null);

    const email = normalizeEmail(codeEmail);
    if (!email) {
      setCodeError("请输入邮箱");
      return;
    }
    if (codeCooldown > 0) return;

    setSubmission("otp-send");
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (error) {
        setCodeError(
          getAuthErrorMessage(error, "验证码发送失败，请稍后重试", "otp"),
        );
        return;
      }

      setCodeCooldown(60);
      setCodeNotice("验证码已发送，请查收邮件");
    } catch (error) {
      setCodeError(
        getAuthErrorMessage(error, "验证码发送失败，请稍后重试", "otp"),
      );
    } finally {
      setSubmission(null);
    }
  };

  const handleOtpLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCodeError(null);
    setCodeNotice(null);

    const email = normalizeEmail(codeEmail);
    const otp = code.trim();
    if (!email) {
      setCodeError("请输入邮箱");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setCodeError("请输入6位数字验证码");
      return;
    }

    setSubmission("otp-login");
    try {
      const { error } = await authClient.signIn.emailOtp({ email, otp });

      if (error) {
        setCodeError(
          getAuthErrorMessage(error, "验证码登录失败，请稍后重试", "otp"),
        );
        return;
      }

      await refetchSession();
      handleClose();
    } catch (error) {
      setCodeError(
        getAuthErrorMessage(error, "验证码登录失败，请稍后重试", "otp"),
      );
    } finally {
      setSubmission(null);
    }
  };

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);

    const email = normalizeEmail(loginEmail);
    if (!email) {
      setLoginError("请输入邮箱");
      return;
    }
    if (!loginPassword) {
      setLoginError("请输入密码");
      return;
    }

    setSubmission("login");
    try {
      const { error } = await authClient.signIn.email({
        email,
        password: loginPassword,
      });

      if (error) {
        setLoginError(
          getAuthErrorMessage(error, "登录失败，请稍后重试", "login"),
        );
        return;
      }

      await refetchSession();
      handleClose();
    } catch (error) {
      setLoginError(getAuthErrorMessage(error, "登录失败，请稍后重试", "login"));
    } finally {
      setSubmission(null);
    }
  };

  const handleRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterError(null);
    setRegisterNotice(null);

    const name = registerName.trim();
    const email = normalizeEmail(registerEmail);
    if (!name) {
      setRegisterError("请输入昵称");
      return;
    }
    if (!email) {
      setRegisterError("请输入邮箱");
      return;
    }
    if (!registerPassword) {
      setRegisterError("请输入密码");
      return;
    }
    if (registerPassword !== registerPasswordConfirm) {
      setRegisterError("两次输入的密码不一致");
      return;
    }
    if (!validatePasswordPolicy(registerPassword).valid) {
      setRegisterError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    setSubmission("register");
    try {
      const { data, error } = await authClient.signUp.email({
        name,
        email,
        password: registerPassword,
      });

      if (error) {
        setRegisterError(
          getAuthErrorMessage(error, "注册失败，请稍后重试", "register"),
        );
        return;
      }

      if (data?.token === null) {
        setRegisterNotice("验证邮件已发送，请前往邮箱完成验证");
        return;
      }

      await refetchSession();
      handleClose();
    } catch (error) {
      setRegisterError(
        getAuthErrorMessage(error, "注册失败，请稍后重试", "register"),
      );
    } finally {
      setSubmission(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={() => {
        if (!submission) handleClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="登录"
        className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">登录深知</h2>
          <button
            type="button"
            aria-label="关闭"
            className="rounded-md p-1 text-faint hover:bg-chip hover:text-ink"
            onClick={handleClose}
            disabled={Boolean(submission)}
          >
            <X className="size-4" />
          </button>
        </div>

        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="mt-4"
        >
          <TabsList className="w-full justify-start border-b border-line">
            <TabsTrigger value="password" disabled={Boolean(submission)}>
              密码登录
            </TabsTrigger>
            <TabsTrigger value="code" disabled={Boolean(submission)}>
              验证码登录
            </TabsTrigger>
            <TabsTrigger value="register" disabled={Boolean(submission)}>
              注册
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form
              className="mt-5 flex flex-col gap-4"
              onSubmit={handlePasswordLogin}
              noValidate
            >
              <Field
                label="邮箱"
                type="email"
                placeholder="请输入邮箱"
                autoComplete="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
              <Field
                label="密码"
                type="password"
                placeholder="请输入密码"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
              <div className="-mt-1.5 flex justify-end">
                <Link
                  href="/reset-password"
                  aria-disabled={Boolean(submission)}
                  onClick={(event) => {
                    if (submission) event.preventDefault();
                  }}
                  className="text-[13px] font-medium text-primary hover:underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  忘记密码?
                </Link>
              </div>
              {loginError && (
                <p className="-mt-2 text-[13px] text-danger" role="alert">
                  {loginError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={Boolean(submission)}
                aria-busy={submission === "login"}
              >
                {submission === "login" ? "登录中..." : "登录"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="code">
            <form
              className="mt-5 flex flex-col gap-4"
              onSubmit={handleOtpLogin}
              noValidate
            >
              <Field
                label="邮箱"
                type="email"
                placeholder="请输入邮箱"
                autoComplete="email"
                value={codeEmail}
                onChange={(event) => setCodeEmail(event.target.value)}
                disabled={Boolean(submission)}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-2">
                  验证码
                </span>
                <div className="flex gap-2">
                  <Input
                    placeholder="请输入6位验证码"
                    className="flex-1"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                    disabled={Boolean(submission)}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    className="shrink-0"
                    disabled={Boolean(submission) || codeCooldown > 0}
                    onClick={handleSendOtp}
                    aria-busy={submission === "otp-send"}
                  >
                    {submission === "otp-send"
                      ? "发送中..."
                      : codeCooldown > 0
                        ? `${codeCooldown}s后重发`
                        : "获取验证码"}
                  </Button>
                </div>
              </div>
              {codeNotice && (
                <p className="-mt-2 text-xs leading-5 text-muted" role="status">
                  {codeNotice}
                </p>
              )}
              {codeError && (
                <p className="-mt-2 text-[13px] text-danger" role="alert">
                  {codeError}
                </p>
              )}
              <Button
                type="submit"
                className="mt-1 w-full"
                disabled={Boolean(submission)}
                aria-busy={submission === "otp-login"}
              >
                {submission === "otp-login" ? "登录中..." : "登录"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form
              className="mt-5 flex flex-col gap-4"
              onSubmit={handleRegistration}
              noValidate
            >
              <Field
                label="昵称"
                placeholder="请输入昵称"
                autoComplete="name"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
              />
              <Field
                label="邮箱"
                type="email"
                placeholder="请输入邮箱"
                autoComplete="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
              />
              <Field
                label="密码"
                type="password"
                placeholder="请输入密码"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
              <p className="-mt-2 text-xs leading-5 text-muted">
                12–64 位，且至少包含大写字母、小写字母和数字
              </p>
              <Field
                label="确认密码"
                type="password"
                placeholder="请再次输入密码"
                autoComplete="new-password"
                value={registerPasswordConfirm}
                onChange={(event) =>
                  setRegisterPasswordConfirm(event.target.value)
                }
              />
              {registerError && (
                <p className="-mt-2 text-[13px] text-danger" role="alert">
                  {registerError}
                </p>
              )}
              {registerNotice && (
                <p className="-mt-2 text-[13px] text-muted" role="status">
                  {registerNotice}
                </p>
              )}
              <Button
                type="submit"
                className="mt-1 w-full"
                disabled={Boolean(submission)}
                aria-busy={submission === "register"}
              >
                {submission === "register" ? "注册中..." : "注册"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
