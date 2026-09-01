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
  const requestNewChat = useAskSidebarBridge((state) => state.requestNewChat);

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
        requestNewChat();
        bumpHistoryRefresh();
      })
      .catch(() => {
        // A page reload safely retries; authentication and Chat remain usable.
      });
  }, [bumpHistoryRefresh, isPending, requestNewChat, session?.user.id]);

  return null;
}
