"use client";

import * as React from "react";
import { X } from "lucide-react";
import { authClient } from "@/lib/auth/client";
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
type Submission = "login" | "register" | null;

const PASSWORD_POLICY_MESSAGE =
  "密码需为12–64位，且至少包含大写字母、小写字母和数字";

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

function getAuthErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: undefined, status: undefined };
  }

  const details = error as Record<string, unknown>;
  return {
    code: typeof details.code === "string" ? details.code : undefined,
    status:
      typeof details.status === "number"
        ? details.status
        : typeof details.statusCode === "number"
          ? details.statusCode
          : undefined,
  };
}

function getAuthErrorMessage(
  error: unknown,
  fallback: string,
  kind: "login" | "register",
) {
  const { code, status } = getAuthErrorDetails(error);

  if (code === "PASSWORD_POLICY_VIOLATION") return PASSWORD_POLICY_MESSAGE;
  if (code === "INVALID_EMAIL") return "请输入有效邮箱";
  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
    return PASSWORD_POLICY_MESSAGE;
  }
  if (
    kind === "login" &&
    (status === 401 ||
      code === "INVALID_EMAIL_OR_PASSWORD" ||
      code === "INVALID_PASSWORD")
  ) {
    return "邮箱或密码错误";
  }
  if (
    kind === "register" &&
    (code === "USER_ALREADY_EXISTS" ||
      code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
  ) {
    return "该邮箱已注册，请直接登录";
  }

  return fallback;
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

  const [registerName, setRegisterName] = React.useState("");
  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] =
    React.useState("");
  const [registerError, setRegisterError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setTab("password");
    setSubmission(null);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setCodeEmail("");
    setCode("");
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterPasswordConfirm("");
    setRegisterError(null);
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

  const handleTabChange = (value: string) => {
    if (submission) return;
    setTab(value as LoginTab);
    setLoginError(null);
    setRegisterError(null);
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
      const { error } = await authClient.signUp.email({
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
                <button
                  type="button"
                  disabled={Boolean(submission)}
                  className="text-[13px] font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  忘记密码?
                </button>
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
            <div className="mt-5 flex flex-col gap-4">
              <Field
                label="邮箱"
                type="email"
                placeholder="请输入邮箱"
                autoComplete="email"
                value={codeEmail}
                onChange={(event) => setCodeEmail(event.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-2">
                  验证码
                </span>
                <div className="flex gap-2">
                  <Input
                    placeholder="请输入验证码"
                    className="flex-1"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    className="shrink-0"
                    disabled
                  >
                    获取验证码
                  </Button>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted" role="status">
                验证码登录将在邮件服务配置后启用
              </p>
              <Button type="button" className="mt-1 w-full" disabled>
                登录
              </Button>
            </div>
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
