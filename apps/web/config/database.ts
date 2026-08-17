import { optionalEnv } from "./env";

/** Server-side database connection configuration only. */
export const databaseConfig = {
  url: optionalEnv("DATABASE_URL"),
};
