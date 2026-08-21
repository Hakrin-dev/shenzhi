/**
 * middleware.ts · Next.js 路由守卫
 * ----------------------------------------------------------------
 * 结合 NextAuth v5 的 `auth` 中间件模式：
 *  1. 未登录用户访问受保护路由 → 302 到 /login?callbackUrl=...
 *  2. 已登录用户访问 /login /register → 302 回 /agents/ask（避免重复登录）
 *  3. API 路由（除 NextAuth 自身 /api/auth/*）：如果未登录 → 返回 401 JSON（不重定向）
 *
 * 受保护路由列表（严格匹配 specs §2.2.2 第二阶段 P1 范围）：
 *  - /agents/*         （AI 问答、深度搜索、深度研究、自动研究、agent 广场已公开首页）
 *  - /settings/*       （个人设置、改密）
 *  - /share/*          （分享页面：其实公开只读，但 P3 再细化；当前未登录禁止生成分享链接，查看分享用公开 matcher）
 */

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config"; // 分离出不含 bcrypt/prisma 的子集，middleware edge 友好

const { auth } = NextAuth(authConfig);

import { NextResponse, type NextRequest } from "next/server";

// 需要登录才能访问的 路径前缀
// UPDATE 2026-08-21: 按用户要求暂时放开 /agents/*（AI 助手页），保证演示顺畅——
// 登录/注册作为可选入口；历史会话/收藏/分享等个人数据仍在 API 层通过 getCurrentUserOrThrow 判断。
const PROTECTED_ROUTE_PREFIXES: string[] = [
  "/settings",          // /settings 及子页
  "/submit",            // /submit/journals 等
];

// 已登录用户访问这些应该跳回主页（避免重复进入登录/注册）
const GUEST_ONLY_ROUTES: string[] = ["/login", "/register"];

// 公开分享页（/share/[token]）：任何人可访问
const PUBLIC_SHARE_PREFIX = "/share/";

export default auth((req: NextRequest & { auth: any }) => {
  const { nextUrl, auth: session } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!session?.user?.id;

  // 1. 公开分享页：永远放行
  if (path.startsWith(PUBLIC_SHARE_PREFIX)) return NextResponse.next();

  // 2. 已登录用户访问 /login、/register → 踢回 AI 助手首页
  if (isLoggedIn && GUEST_ONLY_ROUTES.some((r) => path === r)) {
    return NextResponse.redirect(new URL("/agents/ask", nextUrl));
  }

  const needLogin = PROTECTED_ROUTE_PREFIXES.some((p) => path.startsWith(p));

  // 3. API 路由：未登录 → 401 JSON（中间件先拦截，避免 handler 层再处理；保留 NextAuth 自身 /api/auth 不拦截）
  if (path.startsWith("/api/")) {
    // NextAuth 路由自己处理 auth
    if (path.startsWith("/api/auth/")) return NextResponse.next();
    if (needLoginForApi(path) && !isLoggedIn) {
      return NextResponse.json(
        {
          code: 401,
          message: "未登录或登录已过期，请先登录",
          data: null,
        } as ApiEnvelopeShape,
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // 4. 页面路由：受保护 + 未登录 → 302 /login?callbackUrl=xxx
  if (needLogin && !isLoggedIn) {
    const to = new URL("/login", nextUrl);
    if (path !== "/login") to.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
});

/* ---------- 内部工具 ---------- */

/** API 路由鉴权：只对需要登录的接口做 401 拦截（静态资源 / 公开接口放行） */
function needLoginForApi(path: string): boolean {
  // 公开接口：ai/chat、web-search、uploads、v1 代理（原 A 模式）、auth/* 已单独处理
  // 第二阶段 P1 新接口 /api/users/*、/api/sessions/*、/api/favorites/*、/api/share/* → 都需要登录
  // 这里"默认放行旧公开接口，新接口统一拦截"的策略
  const PUBLIC_API_PREFIXES = [
    "/api/ai/chat",
    "/api/web-search",
    "/api/uploads",
    "/api/v1/",
  ];
  if (PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))) return false;
  return true;
}

/** 对齐 lib/api/search.ts 的 ApiEnvelope 形状（仅类型，不 import 以免 middleware 太重） */
type ApiEnvelopeShape = { code: number; message: string; data: unknown };

/* ---------- matcher：只对应用户端会访问的路径；静态资源 / Next.js 内部路径跳过 ---------- */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|icon.png|sitemap.xml|robots.txt|manifest|sw.js|worker).*)",
  ],
};
