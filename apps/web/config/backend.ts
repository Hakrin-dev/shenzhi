import { optionalEnv } from "./env";

/**
 * FastAPI 业务后端根地址（仅服务端）。
 * 浏览器不得读取；兼容旧名 API_URL。不要使用 NEXT_PUBLIC_ 前缀。
 */
export const backendConfig = {
  url: optionalEnv("BUSINESS_BACKEND_URL") ?? optionalEnv("API_URL"),
};
