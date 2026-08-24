"use client";

import { Github } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SocialProviderMeta {
  id: string;
  label: string;
  icon: LucideIcon;
}

/**
 * 前端社交登录 Provider 元信息。
 * 新增 Provider 时在此登记图标与文案即可。
 */
export const SOCIAL_PROVIDER_META: Record<string, SocialProviderMeta> = {
  github: { id: "github", label: "GitHub", icon: Github },
};

export function getSocialProviderMeta(
  id: string,
): SocialProviderMeta | undefined {
  return SOCIAL_PROVIDER_META[id];
}

/** 登录弹窗需要展示的社交登录入口列表。 */
export function listSocialProviders(): SocialProviderMeta[] {
  return Object.values(SOCIAL_PROVIDER_META);
}
