import { betterAuth } from "better-auth";

import { postgresPool } from "@/lib/infrastructure/postgres";

export const auth = betterAuth({
  database: postgresPool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 64,
  },
});
