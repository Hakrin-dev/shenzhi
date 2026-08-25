import { NextResponse } from "next/server";
import { buildSearchConfig } from "@b/lib/model-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/b/search/config — 按 env 返回百炼 + DeepSeek 可用模型 */
export async function GET() {
  return NextResponse.json({ code: 0, message: "ok", data: buildSearchConfig() });
}
