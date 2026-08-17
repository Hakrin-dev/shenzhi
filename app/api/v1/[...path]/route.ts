import { NextRequest, NextResponse } from "next/server";

/**
 * A 模块标准 API 代理路由
 *
 * 当 NEXT_PUBLIC_AI_BACKEND_MODE = "A" 时，
 * lib/api/search.ts 会请求 /api/v1/search/* 系列接口，
 * 本路由将其转发到环境变量配置的真实后端 API_URL。
 *
 * 环境变量（任一即可）：
 *   API_URL                   = https://your-backend.example.com
 *   NEXT_PUBLIC_API_URL       = https://your-backend.example.com
 *
 * 未配置时返回 503 + 20004 错误码，提示用户配置。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendBase(): string {
  return (
    process.env.API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    ""
  );
}

async function proxy(req: NextRequest, path: string[]) {
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      {
        code: 20004,
        message:
          "生成服务未配置。设置 API_URL 或 NEXT_PUBLIC_API_URL 后即可转发 /api/v1。",
      },
      { status: 503 },
    );
  }

  const dest = `${base}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  // ngrok 免费版拦截：跳过浏览器警告（server-side fetch 也设置，避免被 HTML 拦截页阻挡）
  headers.set("ngrok-skip-browser-warning", "true");

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

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path ?? []);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path ?? []);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path ?? []);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path ?? []);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path ?? []);
}
