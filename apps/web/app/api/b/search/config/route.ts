import { NextResponse } from "next/server";
import { buildSearchConfig } from "@b/lib/model-providers";
import { getQuotaSnapshot } from "@b/lib/server/chat-security";
import { getCurrentUserOrThrow } from "@b/lib/auth-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/b/search/config — 返回模型列表；已登录时 quota 来自 DB 当日用量 */
export async function GET() {
  const data = buildSearchConfig();
  try {
    const user = await getCurrentUserOrThrow();
    data.quota = await getQuotaSnapshot(user.id);
  } catch {
    /* 未登录：保留 buildSearchConfig 默认 quota 占位 */
  }
  return NextResponse.json({ code: 0, message: "ok", data });
}
