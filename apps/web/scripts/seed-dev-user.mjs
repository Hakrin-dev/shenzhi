/**
 * 创建本地 Better Auth 测试账号（需 dev 服务可访问且 DATABASE_URL 已配置）。
 *
 * 用法：npm run dev 运行中，另开终端执行 node scripts/seed-dev-user.mjs
 *
 * 默认账号：
 *   邮箱 dev@shenzhi.local
 *   密码 ShenZhiDev2026!@
 */
const BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const EMAIL = process.env.DEV_SEED_EMAIL ?? "dev@shenzhi.local";
const PASSWORD = process.env.DEV_SEED_PASSWORD ?? "ShenZhiDev2026!@";
const NAME = process.env.DEV_SEED_NAME ?? "Dev Tester";

async function main() {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: NAME,
      email: EMAIL,
      password: PASSWORD,
    }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (res.ok) {
    console.log("✅ 测试账号已就绪，请用以下凭据登录侧栏：");
    console.log(`   邮箱: ${EMAIL}`);
    console.log(`   密码: ${PASSWORD}`);
    return;
  }

  const msg = String(json?.message ?? json?.error ?? text);
  if (/already|exist|duplicate|已存在/i.test(msg)) {
    console.log("ℹ️  账号已存在，可直接登录：");
    console.log(`   邮箱: ${EMAIL}`);
    console.log(`   密码: ${PASSWORD}`);
    return;
  }

  console.error("❌ 创建失败:", res.status, msg);
  console.error(
    "提示: 确认 DATABASE_URL、BETTER_AUTH_SECRET 已配置且 npm run dev 正在运行。",
  );
  console.error("侧栏登录后可使用 AI 对话（chat/upload/web-search 需 Better Auth 会话）。");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
