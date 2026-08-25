/**
 * app/api/auth/[...nextauth]/route.ts
 * NextAuth v5 beta 的标准路由：导出 handlers（GET/POST）即可
 * ┌───────────────────────────────────────────────────────────┐
 * │ 自动接管的路径：                                           │
 * │   GET  /api/auth/signin       → pages.signIn (/login)    │
 * │   POST /api/auth/callback/credentials → 表单 authorize   │
 * │   POST /api/auth/signout      → 销毁 session              │
 * │   GET  /api/auth/session      → 读取 session json         │
 * │   GET  /api/auth/csrf         → CSRF token                │
 * └───────────────────────────────────────────────────────────┘
 */
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
// NextAuth beta 默认行为：允许所有登录方式（Credentials 已在 auth.ts 限定）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
