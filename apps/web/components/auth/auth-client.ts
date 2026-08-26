"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const AUTH_SESSION_INVALID_EVENT = "shenzhi:auth-session-invalid";

/** The single browser-side Better Auth Client used by authentication UI. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  fetchOptions: {
    onError: ({ request, response }) => {
      const requestUrl = request.url.toString();
      if (
        response.status === 401 &&
        !requestUrl.includes("/get-session") &&
        typeof window !== "undefined"
      ) {
        window.dispatchEvent(new Event(AUTH_SESSION_INVALID_EVENT));
      }
    },
  },
});
