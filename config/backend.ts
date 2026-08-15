import { optionalEnv } from "./env";

/** Server-side address of the future business backend. */
export const backendConfig = {
  url: optionalEnv("BUSINESS_BACKEND_URL"),
};
