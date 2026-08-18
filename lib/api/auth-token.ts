/**
 * access_token 仅内存持有（用户系统文档 §1.1）。
 * 登录接入后由 auth store 调用 setAccessToken。
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}
