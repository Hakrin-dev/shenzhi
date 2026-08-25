/**
 * lib/db.ts — Prisma Client 单例（Next.js dev HMR 安全）
 * ----------------------------------------------------------------
 * 原理：globalThis 上挂一个缓存，热重载模块多次 re-execute 时复用同一个 PrismaClient。
 * 否则 Next.js dev server 下 每次 HMR 都 new 一个 Client，SQLite 连接数会爆。
 *
 * UPDATE: 2026-08-21 Build 修复 · Prisma 7 变化：
 *   - PrismaClient 构造函数不再接受 0 参数；必须传 adapter 或 accelerateUrl。
 *   - SQLite 原型：使用 @prisma/adapter-better-sqlite3 + better-sqlite3 同步驱动，
 *     相比 libsql 更适合单机文件模式（Node 原生同步 API，无 Turso/远程依赖）。
 */

import { PrismaClient } from './generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
// UPDATE: 2026-08-21 Build 修复
//  不要 `require('node:path')` 动态 require——turbopack NFT 追踪会把整个项目误判为"动态 filesystem
//  操作"，打印 "Encountered unexpected file in NFT list" 并可能影响优化。用静态 ESM import。
import path from 'node:path';

let prisma: PrismaClient;

// Node.js global 扩展声明（TS 不报错）
declare global {
  // eslint-disable-next-line no-var
  var __prismaSingleton: PrismaClient | undefined;
}

/** 创建 Prisma 7 所需的 better-sqlite3 adapter
 * UPDATE: 2026-08-21 Prisma 7 adapter-better-sqlite3 构造函数只接受 `{ url }` 对象，
 * 不再接受外部构造的 Database 实例。原型直接传 SQLite 文件绝对路径（:memory: 也支持）。
 *
 * NFT 警告修复：turbopack NFT 追踪会把 path.join(process.cwd(), ...) 判定为"可能扫描整个项目"，
 * 加 turbopackIgnore: true 注释声明 —— 这里只会解析项目根下相对 db 文件路径（不会遍历任意子目录）。
 */
function createAdapter() {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  // DATABASE_URL 约定："file:./xxx.db" 或 "file:prisma/xxx.db" → 转绝对路径
  const filePath = dbUrl.startsWith('file:')
    ? dbUrl.slice('file:'.length).replace(/^\.?\//, '')
    : dbUrl;
  const absolute = filePath === ':memory:'
    ? ':memory:'
    : path.isAbsolute(filePath)
        ? filePath
        : path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
  return new PrismaBetterSqlite3({ url: absolute as any });
}

/** 组装 PrismaClient options（Prisma 7 必填 adapter） */
function buildOptions(): ConstructorParameters<typeof PrismaClient>[0] {
  const log = process.env.DEBUG_PRISMA
    ? (['query', 'info', 'warn', 'error'] as const)
    : (['warn', 'error'] as const);
  return {
    adapter: createAdapter(),
    log,
  } as unknown as ConstructorParameters<typeof PrismaClient>[0];
}

if (process.env.NODE_ENV === 'production') {
  // prod：每次进程启动一次即可
  prisma = new PrismaClient(buildOptions());
} else {
  // dev / test：挂到 globalThis 防止 HMR 多实例
  if (!globalThis.__prismaSingleton) {
    globalThis.__prismaSingleton = new PrismaClient(buildOptions());
  }
  prisma = globalThis.__prismaSingleton;
}

export { prisma as db };
export default prisma;
