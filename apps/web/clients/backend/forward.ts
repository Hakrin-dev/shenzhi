import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { backendConfig } from "@/config/backend";

/**
 * Next.js 微后端 → FastAPI 转发。
 * 浏览器只打同源 `/api/v1`；此处补上登录身份并去掉 Cookie，避免把 Better Auth 会话泄漏给 Python。
 */
export async function forwardToBusinessBackend(
  req: NextRequest,
  backendOrigin: string,
  path: string[],
) {
  const dest = `${backendOrigin.replace(/\/$/, "")}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("cookie");
  headers.delete("content-length");
  // Never trust client-supplied identity or internal credentials.
  headers.delete("x-shenzhi-user-id");
  headers.delete("x-shenzhi-user-email");
  headers.delete("x-shenzhi-anonymous-id");
  headers.delete("x-shenzhi-bff-secret");
  const cookie = req.cookies.get("shenzhi-chat-anon")?.value;
  const anonymousId = cookie && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cookie)
    ? cookie : randomUUID();
  headers.set("x-shenzhi-anonymous-id", anonymousId);
  if (backendConfig.secret) headers.set("x-shenzhi-bff-secret", backendConfig.secret);

  await attachIdentity(req, headers);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    signal: req.signal,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    Object.assign(init, { body: req.body, duplex: "half" });
  }

  let upstream: Response;
  try { upstream = await fetch(dest, init); }
  catch {
    return NextResponse.json({ code: 20004, message: "无法连接生成服务，请稍后重试" }, { status: 503 });
  }
  const out = new Headers(upstream.headers);
  out.delete("content-encoding");
  out.delete("transfer-encoding");
  out.delete("set-cookie");
  out.set("Cache-Control", "no-store, no-transform");

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
  if (cookie !== anonymousId) response.cookies.set("shenzhi-chat-anon", anonymousId, {
    httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 86400,
  });
  return response;
}

async function attachIdentity(req: NextRequest, headers: Headers) {
  try {
    const { auth } = await import("@/lib/auth/server");
    const session = await auth.api.getSession({ headers: req.headers });
    const user = session?.user;
    if (!user?.id) return;
    headers.set("X-ShenZhi-User-Id", user.id);
    if (user.email) headers.set("X-ShenZhi-User-Email", user.email);
  } catch {
    /* 未登录或鉴权库未配置：按匿名配额转发 */
  }
}
