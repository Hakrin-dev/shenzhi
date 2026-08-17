import { randomBytes } from "node:crypto";

/**
 * GitHub OAuth 首次登录创建用户时，为账号补齐的 Better Auth
 * `credential` 账户（即邮箱/密码凭证）的 providerId。
 */
export const OAUTH_CREDENTIAL_PROVIDER_ID = "credential";

/**
 * 生成一串极长且随机的占位密码。
 *
 * 该密码不会交付给用户，只用于在数据库的 credential 账户中保存其哈希，
 * 保证 OAuth 账号同样具备 Better Auth 标准的密码凭证结构。
 */
export function generateRandomOAuthPassword(length = 48): string {
  return randomBytes(length).toString("base64url");
}
