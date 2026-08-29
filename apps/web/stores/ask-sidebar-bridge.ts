"use client";

import { create } from "zustand";

export interface SidebarChatHistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  source: "db" | "local";
  favorite?: boolean;
}

export type AskSidebarAction =
  | { type: "load"; item: SidebarChatHistoryItem }
  | { type: "new" }
  | null;

interface AskSidebarBridgeState {
  historyItems: SidebarChatHistoryItem[];
  activeHistoryId: string | null;
  pendingAction: AskSidebarAction;
  historyRefreshNonce: number;
  setSnapshot: (
    historyItems: SidebarChatHistoryItem[],
    activeHistoryId: string | null,
  ) => void;
  requestLoad: (item: SidebarChatHistoryItem) => void;
  requestNewChat: () => void;
  clearPending: () => void;
  bumpHistoryRefresh: () => void;
}

export const useAskSidebarBridge = create<AskSidebarBridgeState>((set) => ({
  historyItems: [],
  activeHistoryId: null,
  pendingAction: null,
  historyRefreshNonce: 0,
  setSnapshot: (historyItems, activeHistoryId) =>
    set({ historyItems, activeHistoryId }),
  requestLoad: (item) => set({ pendingAction: { type: "load", item } }),
  requestNewChat: () => set({ pendingAction: { type: "new" } }),
  clearPending: () => set({ pendingAction: null }),
  bumpHistoryRefresh: () =>
    set((s) => ({ historyRefreshNonce: s.historyRefreshNonce + 1 })),
}));
