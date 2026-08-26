import { createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth/types";

import { hasPasswordFromAccounts } from "@/lib/auth/password/status";

interface SessionResponse {
  session?: unknown;
  user?: { id?: string; [key: string]: unknown };
}

/**
 * 在 `/get-session` 返回的用户对象上注入 `hasPassword` 字段，
 * 供前端「修改密码 / 设置密码」表单动态渲染使用。
 */
export function passwordStatus(): BetterAuthPlugin {
  return {
    id: "password-status",
    hooks: {
      after: [
        {
          matcher: (context) => context.path === "/get-session",
          handler: createAuthMiddleware(async (ctx) => {
            const returned = (ctx as unknown as {
              context: { returned?: unknown };
            }).context.returned as SessionResponse | null | undefined;

            const user = returned?.user;
            if (!user?.id) return;

            const accounts =
              await ctx.context.internalAdapter.findAccounts(user.id);
            const hasPassword = hasPasswordFromAccounts(accounts);

            return ctx.json({
              ...returned,
              user: { ...user, hasPassword },
            });
          }),
        },
      ],
    },
  };
}
