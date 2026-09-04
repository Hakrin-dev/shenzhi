import { ApiError } from "../../../clients/backend/http";
import type { ApiEnvelope } from "../../../types/ai-search";

export interface AnonymousClaimResult {
  moved_count: number;
  skipped_streaming_count: number;
  durable: boolean;
}

export function anonymousClaimAttemptUser(
  isPending: boolean,
  userId: string | undefined,
  attemptedUserId: string | null,
): string | null {
  if (isPending || !userId || attemptedUserId === userId) return null;
  return userId;
}

export function shouldRefreshAfterAnonymousClaim(result: AnonymousClaimResult): boolean {
  return result.durable && result.moved_count > 0;
}

export async function claimAnonymousSessions(
  fetcher: typeof fetch = fetch,
): Promise<AnonymousClaimResult> {
  const response = await fetcher("/api/chat/anonymous-claim", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  let envelope: ApiEnvelope<AnonymousClaimResult> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<AnonymousClaimResult>;
  } catch {
    throw new ApiError(20004, "匿名会话归属响应无法解析", response.status);
  }
  if (!response.ok || envelope.code !== 0 || !envelope.data) {
    throw new ApiError(
      envelope.code ?? 20004,
      envelope.message ?? "匿名会话归属切换失败",
      response.status,
    );
  }
  return envelope.data;
}
