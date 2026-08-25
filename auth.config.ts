/**
 * auth.config.ts — NextAuth 的"中间件友好版"子集
 * ----------------------------------------------------------------
 * 【为什么要拆？】
 * middleware.ts 必须跑在 Edge-compatible 模块里（Next.js 编译时会把中间件打成独立 bundle），
 * 但 auth.ts 里 import 了 bcryptjs、@/lib/db → Prisma Client → Node-only 依赖。
 * 直接在 middleware 里 import auth.ts 会报一堆 Node native 找不到的错。
 *
 * 【拆分原则】
 *  - auth.config.ts：只放 session/jwt callbacks、trustHost、pages 路径、secret 读取
 *                   （这些是"解码 JWT 生成 Session"所需，providers 不需要）
 *  - auth.ts       ：在 auth.config 基础上 merge Credentials Provider + Node-only 工具
 *
 *  NextAuth v5 设计就是支持"两段式"：分别从两份 config 创建两个不同的 NextAuth() 实例
 *  也完全 OK（两个实例共享同一个 AUTH_SECRET → JWT 签名一致 → Session 互相能解码）。
 */

import type { NextAuthConfig } from "next-auth";
import type { DefaultSession } from "next-auth";

// 复用 auth.ts 的类型扩展；middleware 这里 import 不影响（纯类型被 TS 擦除）
// UPDATE: 2026-08-21 Build 修复
//  注意：NextAuth 默认 Session.user.email 是 `string | undefined`，
//  所以这里不扩展成 `email?: string | null`（否则与 DefaultSession 原始类型冲突）。
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
    } & DefaultSession["user"];
  }
}
// UPDATE: 2026-08-21 Build 修复
//  NextAuth v5 beta 包里模块路径不稳定（@auth/core/jwt 找不到）。
//  但 JWT 类型本身是 Indexable（允许任意 key），实际 runtime 可以直接写 uid/email。
//  这里把 declare module 删了，callbacks 里用 `as any` 兜底即可。

export const authConfig: NextAuthConfig = {
  trustHost: true,
  // UPDATE: 2026-08-21 Build 修复
  //  NextAuth v5 NextAuthConfig TS 类型要求 providers 必填（即使 middleware 不用）。
  //  传空数组作为"无 provider 版本"——middleware 只做 JWT 解码，不参与登录流程。
  providers: [],
  // session strategy 走 JWT（SQLite + Credentials 无需 DB Session）
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).uid = user.id;
        if (user.email !== undefined) (token as any).email = user.email ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      const uid = (token as any)?.uid;
      if (typeof uid === "string") {
        const emailFromToken = (token as any)?.email as unknown;
        const emailValue =
          typeof emailFromToken === "string" ? emailFromToken : undefined;
        // UPDATE: 2026-08-21 Build 修复
        //  DefaultSession.user 里的字段在 TS 4.9+/NextAuth beta 下可能被推断为
        //  readonly 或与 & 扩展后的 { id, name } 产生不可写冲突，
        //  直接 Object.assign 绕过交叉类型的 readonly 校验。
        Object.assign(session.user, {
          id: uid,
          name:
            (session.user.name as string) ??
            ((token as any).name as string) ??
            "",
          email: emailValue,
        });
      }
      return session;
    },
  },
};
