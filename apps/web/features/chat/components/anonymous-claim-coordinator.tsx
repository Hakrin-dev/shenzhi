"use client";

import { useEffect, useRef } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useAskSidebarBridge } from "@/stores/ask-sidebar-bridge";
import {
  anonymousClaimAttemptUser,
  claimAnonymousSessions,
  shouldRefreshAfterAnonymousClaim,
} from "../services/anonymous-claim";

export function AnonymousClaimCoordinator() {
  const { session, isPending } = useAuth();
  const attemptedUserRef = useRef<string | null>(null);
  const bumpHistoryRefresh = useAskSidebarBridge((state) => state.bumpHistoryRefresh);
  const requestReset = useAskSidebarBridge((state) => state.requestReset);

  useEffect(() => {
    const userId = session?.user.id;
    const attemptUser = anonymousClaimAttemptUser(
      isPending,
      userId,
      attemptedUserRef.current,
    );
    if (!attemptUser) return;
    attemptedUserRef.current = attemptUser;

    void claimAnonymousSessions()
      .then((result) => {
        if (!shouldRefreshAfterAnonymousClaim(result)) return;
        requestReset();
        bumpHistoryRefresh();
      })
      .catch(() => {
        // A page reload safely retries; authentication and Chat remain usable.
      });
  }, [bumpHistoryRefresh, isPending, requestReset, session?.user.id]);

  return null;
}
