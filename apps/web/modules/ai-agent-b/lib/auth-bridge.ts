import { headers } from "next/headers";
import { db } from "@b/lib/db";

/** 将 Better Auth 用户同步到 B 模块 SQLite User 表（外键前置条件） */
async function ensureBModuleUser(user: {
  id: string;
  email: string | null;
  name: string | null;
}) {
  const uniqueName = `u_${user.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}`;
  await db.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      name: uniqueName,
      email: user.email,
      passwordHash: "external:better-auth",
    },
    update: {
      email: user.email,
    },
  });
}

/** B 模块鉴权桥接：复用 A 侧 Better Auth，替代 B 分支的 NextAuth。 */
export async function getCurrentUserOrThrow(): Promise<{
  id: string;
  email: string | null;
}> {
  const { auth } = await import("@/lib/auth/server");
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.id) {
    const err = new Error("未登录");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  await ensureBModuleUser({
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
  });
  return { id: user.id, email: user.email ?? null };
}
