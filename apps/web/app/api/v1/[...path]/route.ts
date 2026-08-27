import { NextRequest, NextResponse } from "next/server";

import { backendConfig, backendConnectionIsAllowed } from "@/config/backend";
import { forwardToBusinessBackend } from "@/clients/backend/forward";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const base = backendConfig.url;
  if (!base) {
    return NextResponse.json(
      {
        code: 20004,
        message:
          "生成服务未配置。请在服务端设置 BUSINESS_BACKEND_URL（FastAPI 根地址，勿使用 NEXT_PUBLIC_）。",
      },
      { status: 503 },
    );
  }
  if (!backendConnectionIsAllowed(backendConfig)) {
    return NextResponse.json(
      {
        code: 10001,
        message: "后端调用凭据未配置。请配置 BACKEND_BFF_SECRET；仅 loopback 本地开发可显式设置 BACKEND_ALLOW_INSECURE_LOCAL_BFF=true。",
      },
      { status: 503 },
    );
  }

  const path = (await ctx.params).path ?? [];
  return forwardToBusinessBackend(req, base, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
