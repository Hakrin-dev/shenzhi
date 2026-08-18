import { NextRequest, NextResponse } from "next/server";

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

  await attachIdentity(req, headers);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    Object.assign(init, { body: req.body, duplex: "half" });
  }

  const upstream = await fetch(dest, init);
  const out = new Headers(upstream.headers);
  out.delete("content-encoding");
  out.delete("transfer-encoding");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
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
