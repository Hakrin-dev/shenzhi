import { optionalEnv } from "./env";

/** GitHub OAuth Provider 在 Better Auth 中的固定 ID。 */
export const GITHUB_OAUTH_PROVIDER = "github" as const;

export interface GithubOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
}

/**
 * 从部署环境读取 GitHub OAuth Client 凭据。
 *
 * 与邮件 Provider 一致：配置不完整时返回 undefined，应用仍可正常启动，
 * 仅在用户点击 GitHub 登录时 Better Auth 才会返回 Provider 未配置错误。
 */
export const githubOAuthConfig: GithubOAuthConfig | undefined = (() => {
  const clientId = optionalEnv("GITHUB_CLIENT_ID");
  const clientSecret = optionalEnv("GITHUB_CLIENT_SECRET");

  if (!clientId || !clientSecret) return undefined;

  return { clientId, clientSecret };
})();

export const githubOAuthConfigured = githubOAuthConfig !== undefined;
