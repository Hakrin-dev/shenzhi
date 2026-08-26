"use client";

import { create } from "zustand";

/** 与 useAskSession 中 AskHistoryItem 结构一致 */
export interface SidebarChatHistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  source: "db" | "local";
}

export type AskSidebarAction =
  | { type: "load"; item: SidebarChatHistoryItem }
  | { type: "new" }
  | null;

interface AskSidebarBridgeState {
  historyItems: SidebarChatHistoryItem[];
  activeHistoryId: string | null;
  pendingAction: AskSidebarAction;
  setSnapshot: (
    historyItems: SidebarChatHistoryItem[],
    activeHistoryId: string | null,
  ) => void;
  requestLoad: (item: SidebarChatHistoryItem) => void;
  requestNewChat: () => void;
  clearPending: () => void;
}

export const useAskSidebarBridge = create<AskSidebarBridgeState>((set) => ({
  historyItems: [],
  activeHistoryId: null,
  pendingAction: null,
  setSnapshot: (historyItems, activeHistoryId) =>
    set({ historyItems, activeHistoryId }),
  requestLoad: (item) => set({ pendingAction: { type: "load", item } }),
  requestNewChat: () => set({ pendingAction: { type: "new" } }),
  clearPending: () => set({ pendingAction: null }),
}));
