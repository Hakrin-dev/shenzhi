"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

/** The single browser-side Better Auth Client used by authentication UI. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
