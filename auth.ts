/**
 * auth.ts · NextAuth.js (v5 beta) Credentials 认证配置
 * ----------------------------------------------------------------
 * 【技术选型对比（.trae/documents/第二阶段-技术选型预研.md §1）】
 *  ✅ 方案 A：NextAuth Credentials Provider（当前实现）
 *     - 支持 Session/JWT、bcrypt 密码校验、Nodemailer 找回密码
 *     - 后续可加 GitHub/Google OAuth 不破坏当前代码
 *  ❌ 方案 B：自建 JWT
 *     - 少一个依赖，但要自己写中间件、刷新机制、防 CSRF（性价比低）
 *
 * 【NextAuth v5 beta 关键区别】
 *  1. authOptions → `NextAuth({...})` 直接函数调用
 *  2. handlers/auth/signIn/signOut/unstable_update in one export
 *  3. route handler 在 app/api/auth/[...nextauth]/route.ts 直接 `export { GET, POST }`
 */

import NextAuth, { type DefaultSession, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config"; // 共用 callbacks / pages / session strategy 配置

/* ==============================================================
   1. 类型扩展：把 id / name 塞进 Session（方便前端读取）
 * UPDATE: 2026-08-21 Build 修复
 *  - email 不手动声明为 `|null`（NextAuth 默认 Session.user.email 是 string|undefined），
 *    否则 TS 合并时和 auth.config.ts 中 declare module 不一致也会有警告；
 *    业务需要 null → 在 getCurrentUserOrThrow 内统一 `?? null`。
   ============================================================== */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
    } & DefaultSession["user"];
  }
}

/* ==============================================================
   2. Zod Schema：登录 / 注册表单校验（前后端共享）
   ============================================================== */
export const LoginSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "用户名至少 2 个字符")
    .max(32, "用户名最多 32 个字符"),
  password: z
    .string()
    .min(6, "密码至少 6 个字符")
    .max(64, "密码最多 64 个字符"),
});

export const RegisterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "用户名至少 2 个字符")
      .max(32, "用户名最多 32 个字符")
      .regex(/^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/, "仅支持字母 / 数字 / 下划线 / 短横线 / 中文"),
    email: z
      .string()
      .trim()
      .max(128, "邮箱最多 128 个字符")
      .email("邮箱格式不正确")
      // 找回密码用；原型阶段允许留空（但填了必须合法）
      .or(z.literal("")),
    password: z
      .string()
      .min(6, "密码至少 6 个字符")
      .max(64, "密码最多 64 个字符"),
    confirm: z.string().min(6, "请再次输入密码"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "两次输入的密码不一致",
    path: ["confirm"],
  });

/* ==============================================================
   3. Credentials Provider · 登录 authorize 函数
   ============================================================== */
class AuthError extends CredentialsSignin {
  // CredentialsSignin.code 会被前端 NextAuth 识别为错误类型
  constructor(public override code: string, message?: string) {
    super(message);
  }
}

/* ==============================================================
   4. NextAuth 主配置
   ============================================================== */
export const {
  handlers, // { GET, POST } → route.ts 直接导出
  auth,     // Server Component / Route Handler / Server Action 读取 session
  signIn,   // Server Action 编程式登录
  signOut,  // Server Action 编程式登出
} = NextAuth({
  // 继承 auth.config.ts 里的 callbacks / pages / session strategy / trustHost
  ...authConfig,
  providers: [
    Credentials({
      // 自定义 authorize：查 User 表 + bcrypt.compare
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new AuthError(
            "InvalidCredentials",
            parsed.error.issues.map((i) => i.message).join("；"),
          );
        }
        const { name, password } = parsed.data;
        const user = await db.user.findUnique({ where: { name } });
        if (!user) throw new AuthError("UserNotFound", "用户不存在");
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new AuthError("WrongPassword", "密码错误");
        // 返回值被塞进 JWT；再由 auth.config.ts 的 jwt/session callbacks 写到前端可读 session
        return {
          id: user.id,
          name: user.name,
          email: user.email ?? null,
        };
      },
    }),
  ],
});

/* ==============================================================
   5. 便捷工具：服务端读取当前用户（供 route.ts / server action 使用）
   ============================================================== */

/**
 * 从当前请求读取登录用户；未登录抛错 → 上游 route 可直接 catch 成 401
 * 用法：
 *   const user = await getCurrentUserOrThrow();
 *   // ... user.id 一定非空
 */
export async function getCurrentUserOrThrow(): Promise<{
  id: string;
  name: string;
  email: string | null;
}> {
  const s = await auth();
  if (!s?.user?.id) {
    const err = new Error("未登录或登录已过期，请重新登录");
    (err as any).code = "UNAUTHORIZED";
    (err as any).status = 401;
    throw err;
  }
  return {
    id: s.user.id,
    name: s.user.name,
    email: s.user.email ?? null,
  };
}

/** 安全版本：读不到 session 时返回 null（用于"可选登录"场景的 UI 判断） */
export async function tryGetCurrentUser() {
  try {
    return await getCurrentUserOrThrow();
  } catch {
    return null;
  }
}

/* ==============================================================
   6. 注册 / 找回密码 · 非 NextAuth 职责，自建 API 辅助
   ============================================================== */
export const BCRYPT_ROUNDS = 10;

export async function registerUser(input: z.infer<typeof RegisterSchema>) {
  const parsed = RegisterSchema.parse(input);
  // 用户名 / 邮箱唯一（Prisma @@unique 会兜底 + 报 P2002，我们先查给出更友好的中文）
  const existsName = await db.user.findUnique({ where: { name: parsed.name } });
  if (existsName) {
    const err = new Error("该用户名已被注册");
    (err as any).code = "NAME_TAKEN";
    throw err;
  }
  if (parsed.email) {
    const existsEmail = await db.user.findUnique({ where: { email: parsed.email } });
    if (existsEmail) {
      const err = new Error("该邮箱已被注册");
      (err as any).code = "EMAIL_TAKEN";
      throw err;
    }
  }
  const hash = await bcrypt.hash(parsed.password, BCRYPT_ROUNDS);
  const user = await db.user.create({
    data: {
      name: parsed.name,
      email: parsed.email || null,
      passwordHash: hash,
      passwordHashVersion: 1,
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  return user;
}

/**
 * 重置密码（已验证 token 后调用；或由已登录用户在设置页改密调用）
 *  - loginRequired=true 表示：用户自己在"设置→改密"页面，必须额外校验 oldPassword
 *  - loginRequired=false 表示：通过邮箱找回令牌 → 直接重置（调用方需先行验证令牌有效）
 */
export async function resetPassword(input: {
  userId: string;
  newPassword: string;
  oldPassword?: string;
  loginRequired?: boolean;
}) {
  const pwd = z
    .string()
    .min(6, "新密码至少 6 个字符")
    .max(64, "新密码最多 64 个字符")
    .parse(input.newPassword);
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    const err = new Error("用户不存在");
    (err as any).code = "USER_NOT_FOUND";
    throw err;
  }
  if (input.loginRequired) {
    if (!input.oldPassword) {
      const err = new Error("修改密码必须提供原密码");
      (err as any).code = "OLD_PASSWORD_REQUIRED";
      throw err;
    }
    const ok = await bcrypt.compare(input.oldPassword, user.passwordHash);
    if (!ok) {
      const err = new Error("原密码错误");
      (err as any).code = "OLD_PASSWORD_WRONG";
      throw err;
    }
  }
  const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, passwordHashVersion: 1 },
  });
  return true;
}

/**
 * 生成找回密码的令牌（写 PasswordResetToken 表）
 * - 原型：默认有效期 1 小时；若没有配置 SMTP → 返回 token 字符串给接口提示，
 *   让开发/演示场景直接用 ?token=xxx 打开 /reset-password
 * - 生产：由路由层调 Nodemailer 把 token 嵌入邮件链接发送（不返回 token）
 */
export async function createPasswordResetToken(userId: string) {
  const crypto = await import("node:crypto");
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1h
  await db.passwordResetToken.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

/**
 * 验证找回密码令牌：有效 → 返回 userId；无效 / 过期 / 已使用 → 抛错
 */
export async function verifyPasswordResetToken(token: string): Promise<string> {
  const row = await db.passwordResetToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true, usedAt: true },
  });
  if (!row) {
    const err = new Error("重置链接不存在或已失效");
    (err as any).code = "TOKEN_NOT_FOUND";
    throw err;
  }
  if (row.usedAt) {
    const err = new Error("该重置链接已被使用");
    (err as any).code = "TOKEN_USED";
    throw err;
  }
  if (row.expiresAt.getTime() < Date.now()) {
    const err = new Error("该重置链接已过期（有效期 1 小时）");
    (err as any).code = "TOKEN_EXPIRED";
    throw err;
  }
  // 标记已使用（防重放）
  await db.passwordResetToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });
  return row.userId;
}
