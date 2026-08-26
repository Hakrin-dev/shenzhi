/**
 * 探测百炼控制台免费额度模型是否可调用，并尝试读取 usage
 * 用法：node scripts/probe-bailian-models.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = readFileSync(resolve(root, ".env.local"), "utf8");
const key = envLocal.match(/^DASHSCOPE_API_KEY=(.+)$/m)?.[1]?.trim();
const base =
  envLocal.match(/^DASHSCOPE_BASE_URL=(.+)$/m)?.[1]?.trim() ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

/** 控制台截图（两张图合计 14 个模型 Code） */
const SCREENSHOT_CATALOG = [
  // 图 1
  "deepseek-v3-pro-0813",
  "qwen2.5-plus-2024-09-19",
  "qwen2.5-7b-instruct",
  "qwen2.5-max",
  // 图 2
  "qwen3.8-27b",
  "qwen3.7-flash-2026-07-15",
  "kimi-k3",
  "qwen3.7-plus",
  "qwen3.5-ocr",
  "qwen3.7-flash",
  "qwen3.7-max-2026-06-08",
  "deepseek-v4-flash-0731",
  "glm-5.2",
  "kimi-k2.7-code",
];

if (!key) {
  console.error("未找到 DASHSCOPE_API_KEY");
  process.exit(1);
}

const baseUrl = base.replace(/\/+$/, "");
console.log("Base URL:", baseUrl);
console.log("---");

// 1) 尝试列出可用模型
try {
  const modelsRes = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (modelsRes.ok) {
    const j = await modelsRes.json();
    const ids = (j.data ?? []).map((m) => m.id).filter(Boolean);
    console.log(`GET /models 返回 ${ids.length} 个模型（不含量度信息）`);
    const inList = SCREENSHOT_CATALOG.filter((m) => ids.includes(m));
    const notInList = SCREENSHOT_CATALOG.filter((m) => !ids.includes(m));
    if (inList.length) console.log("  在 /models 中:", inList.join(", "));
    if (notInList.length)
      console.log("  不在 /models 中:", notInList.join(", "));
  } else {
    console.log(`GET /models → HTTP ${modelsRes.status}`);
  }
} catch (e) {
  console.log("GET /models 失败:", e.message);
}

console.log("---");
console.log("chat/completions 最小探测（验证可调用性）:");

const url = `${baseUrl}/chat/completions`;
const results = [];

for (const model of SCREENSHOT_CATALOG) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  });
  let msg = "";
  let usage = null;
  if (res.ok) {
    try {
      const j = await res.json();
      usage = j.usage ?? null;
      msg = "OK";
    } catch {
      msg = "OK";
    }
  } else {
    try {
      const j = await res.json();
      msg = j?.error?.message || `HTTP ${res.status}`;
    } catch {
      msg = `HTTP ${res.status}`;
    }
  }
  results.push({ model, ok: res.ok, msg, usage });
  const mark = res.ok ? "✓" : "✗";
  const usageStr = usage
    ? ` tokens=${usage.total_tokens ?? "?"}`
    : "";
  console.log(`${mark} ${model}${usageStr} — ${msg.slice(0, 100)}`);
}

console.log("---");
const ok = results.filter((r) => r.ok);
const fail = results.filter((r) => !r.ok);
console.log(`可调用 ${ok.length} / ${SCREENSHOT_CATALOG.length}`);
if (fail.length) {
  console.log("不可调用:");
  for (const f of fail) console.log(`  ${f.model}: ${f.msg.slice(0, 120)}`);
}
