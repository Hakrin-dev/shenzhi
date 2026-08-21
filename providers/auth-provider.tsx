"use client";

/**
 * providers/auth-provider.tsx
 * 把 NextAuth SessionProvider 包一层（Client Component 专用），
 * 用于在 app/layout.tsx 这种 Server Component 里使用 —— Next.js 不允许在 Server 组件
 * 里直接 import "next-auth/react" 的 SessionProvider（必须 client 组件包装）。
 *
 * SessionProvider 的 refetchInterval：30 分钟刷新一次 session；
 * 原型阶段 30min 够了（JWT 默认 maxAge = 30 天，但主动刷新可提前感知被改密/登出）。
 */

import * as React from "react";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export function AuthProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <NextAuthSessionProvider session={session} refetchInterval={30 * 60} refetchOnWindowFocus>
      {children}
    </NextAuthSessionProvider>
  );
}
