import type { Account } from "better-auth";

import {
  OAUTH_CREDENTIAL_PROVIDER_ID,
  OAUTH_PLACEHOLDER_SCOPE,
} from "@/lib/auth/providers/oauth/credential";

/**
 * 判断用户是否拥有「真实可用的邮箱/密码凭证」。
 *
 * 规则：
 * - 不存在 `credential` 账户 → false（纯 OAuth 用户尚未设置密码）；
 * - 密码为空 → false；
 * - 密码是 OAuth 自动补写的随机占位符（scope 标记） → false；
 * - 其余情况 → true。
 */
export function hasPasswordFromAccounts(
  accounts: Array<
    Pick<Account, "providerId" | "password" | "scope">
  >,
): boolean {
  const credential = accounts.find(
    (account) => account.providerId === OAUTH_CREDENTIAL_PROVIDER_ID,
  );

  if (!credential?.password) return false;
  if (credential.scope === OAUTH_PLACEHOLDER_SCOPE) return false;

  return true;
}
