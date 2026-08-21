import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { auth } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "深知 ShenZhi · Research OS",
  description: "深知 —— 面向科研工作者的论文发现、投稿跟踪与 AI 研究助手平台",
};

/**
 * 首屏前确定主题,避免闪烁:
 * ?theme=dark|light|system(调试/分享)> localStorage("dark"|"light"|"system")> 系统偏好
 */
const themeScript = `(function(){try{var p=new URLSearchParams(location.search).get("theme");var t=p==="dark"||p==="light"||p==="system"?p:localStorage.getItem("shenzhi-theme");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=t==="dark"||(t!=="light"&&m);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

/**
 * UPDATE: 2026-08-21 P1 用户系统
 *  - RootLayout 是 Server Component，可以直接调用 auth()（NextAuth v5 的 server 版 API）
 *  - 拿到 session 后传给 AuthProvider，避免客户端首次渲染闪烁
 *  - 外层 QueryProvider → AuthProvider：auth session 可被 react-query / 业务组件同时消费
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth().catch(() => null);
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <QueryProvider>
          <AuthProvider session={session ?? undefined}>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
