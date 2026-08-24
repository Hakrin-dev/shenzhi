import { optionalEnv } from "./env";

export interface OAuthProviderConfig {
  readonly id: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

/** 读取某个 OAuth Provider 的 Client 凭据;配置不完整时返回 undefined。 */
function readOAuthProviderConfig(id: string): OAuthProviderConfig | undefined {
  const prefix = id.toUpperCase();
  const clientId = optionalEnv(`${prefix}_CLIENT_ID`);
  const clientSecret = optionalEnv(`${prefix}_CLIENT_SECRET`);

  if (!clientId || !clientSecret) return undefined;

  return { id, clientId, clientSecret };
}

/**
 * 已配置的 OAuth Provider 列表。
 *
 * 每个 Provider 对应 `{大写ID}_CLIENT_ID` / `{大写ID}_CLIENT_SECRET` 环境变量；
 * 与邮件 Provider 一致：配置不完整时该 Provider 不启用，应用照常启动，
 * 仅在用户点击该 Provider 登录时 Better Auth 才会返回未配置错误。
 * 新增 Provider 只需在此登记一项。
 */
export const configuredOAuthProviders: OAuthProviderConfig[] = [
  readOAuthProviderConfig("github"),
].filter((config): config is OAuthProviderConfig => config !== undefined);

export const oauthProvidersConfigured = configuredOAuthProviders.length > 0;

export function getOAuthProviderConfig(
  id: string,
): OAuthProviderConfig | undefined {
  return configuredOAuthProviders.find((config) => config.id === id);
}
