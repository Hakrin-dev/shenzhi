import { postgresPool } from "@/lib/infrastructure/postgres";

import { TURNSTILE_VERIFIED_TTL_SECONDS } from "./turnstile";

/**
 * 判断某个匿名客户端是否在有效期内已通过人机验证。
 *
 * 该状态只存在于后端数据库;数据库不可用时按“未通过”处理(fail closed),
 * 保证无法跳过人机验证。
 */
export async function isTurnstileVerified(
  clientId: string | null | undefined,
): Promise<boolean> {
  if (!clientId) return false;

  try {
    const result = await postgresPool.query(
      'select 1 from "turnstile_verification" where "clientId" = $1 and "expiresAt" > now()',
      [clientId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * 记录某个匿名客户端已通过人机验证,有效期为 15 分钟。
 *
 * 写入失败不会中断当前请求(Cloudflare 已在本请求内校验过 token),只是
 * 后续其他功能无法复用该“已验证”状态,需要重新完成一次挑战。
 */
export async function markTurnstileVerified(clientId: string): Promise<void> {
  const expiresAt = new Date(
    Date.now() + TURNSTILE_VERIFIED_TTL_SECONDS * 1000,
  );

  try {
    await postgresPool.query(
      `insert into "turnstile_verification" ("clientId", "expiresAt")
       values ($1, $2)
       on conflict ("clientId") do update set "expiresAt" = excluded."expiresAt"`,
      [clientId, expiresAt],
    );
  } catch {
    // 忽略写入失败,不阻断已经通过 Cloudflare 校验的当前操作。
  }
}
