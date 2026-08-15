"use client";

import { createAuthClient } from "better-auth/react";

/** The single browser-side Better Auth Client used by authentication UI. */
export const authClient = createAuthClient();
