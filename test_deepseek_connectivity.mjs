/**
 * DeepSeek API 连通性测试脚本（Windows Node.js 直接运行）
 *
 * 用法：
 *   1) 把 API Key 填到下面的 DEEPSEEK_API_KEY 常量（或 .env 读取）
 *   2) 在 shenzhi 目录下执行：node test_deepseek_connectivity.mjs
 *
 * 覆盖测试：
 *   Test 1 —— 非流式（POST /chat/completions, stream=false）
 *   Test 2 —— 流式 SSE（POST /chat/completions, stream=true）
 *   Test 3 —— 错误鉴权测试（故意用错 Key，确认错误结构解析正常）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/* =========================================================
 *  1. 读环境变量优先级：
 *     - 直接读 shenzhi/.env.local（首选，和 Next.js 同一来源）
 *     - 回退到 process.env
 *     - 最后硬编码（仅便于临时改脚本调试）
 * ======================================================= */
const ENV_LOCAL = path.resolve(
  new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:\/)/, "$1"),
  ".env.local",
);

function loadEnvLocal() {
  const map = {};
  if (!fs.existsSync(ENV_LOCAL)) return map;
  const raw = fs.readFileSync(ENV_LOCAL, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[k] = v;
  }
  return map;
}

const env = loadEnvLocal();
/* ⚠️ 安全红线：绝对不要把真实 API Key 硬编码在这里！
 *   本脚本只从两个安全来源读取 Key（均不进入 Git 仓库）：
 *     1. 本目录 .env.local（首选，与 Next.js 同一来源；.gitignore 已忽略 .env*）
 *     2. 进程环境变量 process.env.DEEPSEEK_API_KEY（例如 CI Secrets 注入）
 *   如果两者都不存在，脚本会打印明确的配置指引并优雅退出，绝不在仓库留下任何密钥痕迹。
 */
const DEEPSEEK_API_KEY =
  (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim()) ||
  (env.DEEPSEEK_API_KEY && env.DEEPSEEK_API_KEY.trim()) ||
  "";
const DEEPSEEK_BASE_URL = (
  process.env.DEEPSEEK_BASE_URL ||
  env.DEEPSEEK_BASE_URL ||
  "https://api.deepseek.com/v1"
).replace(/\/+$/, "");
const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL || env.DEEPSEEK_MODEL || "deepseek-chat";

/* =========================================================
 *  工具函数
 * ======================================================= */
let TEST_IDX = 0;
function section(title) {
  TEST_IDX += 1;
  const n = TEST_IDX;
  const bar = "=".repeat(72);
  console.log(`\n${bar}`);
  console.log(`Test ${n} · ${title}`);
  console.log(bar);
  return n;
}
function hr() {
  console.log("-".repeat(72));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function ok(text) {
  console.log(`✅ PASS  ${text}`);
}
function fail(text) {
  console.log(`❌ FAIL  ${text}`);
  process.exitCode = 1;
}
function info(text) {
  console.log(`ℹ️  ${text}`);
}

/* =========================================================
 *  Test 1: 非流式请求
 * ======================================================= */
async function test1NonStreaming() {
  const n = section("非流式 chat/completions (stream=false)");
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const payload = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: "你是简洁的测试助手。" },
      { role: "user", content: "用 20 字以内回答：1+1 等于几？" },
    ],
    temperature: 0.1,
    max_tokens: 200,
    stream: false,
  };

  info(`POST ${url}`);
  info(`model: ${payload.model} | 提问长度: ${payload.messages[1].content.length} 字`);
  hr();

  let res;
  const t0 = Date.now();
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    fail(`网络层失败：${e.name}: ${e.message}`);
    info("常见原因：本机无网 / 代理阻断 / DEEPSEEK_BASE_URL 拼写错误 / DNS 解析失败");
    return false;
  }
  const dur = Date.now() - t0;
  info(`HTTP ${res.status} ${res.statusText} | 耗时 ${dur}ms`);

  let rawBody;
  try {
    rawBody = await res.text();
  } catch (e) {
    fail(`无法读取响应体：${e.message}`);
    return false;
  }

  if (!res.ok) {
    fail(`非 2xx 响应（前 800 字）：${rawBody.slice(0, 800)}`);
    // 尝试解析错误字段
    try {
      const j = JSON.parse(rawBody);
      if (j?.error) {
        info(`错误字段解析: code=${j.error.code}  message=${j.error.message}`);
      }
    } catch (_) {}
    return false;
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (e) {
    fail(`响应不是合法 JSON（前 800 字）：${rawBody.slice(0, 800)}`);
    return false;
  }

  const content = data?.choices?.[0]?.message?.content;
  const usage = data?.usage;
  if (!content || typeof content !== "string") {
    fail(`choices[0].message.content 缺失或为空。完整结构：${JSON.stringify(data).slice(0, 600)}`);
    return false;
  }

  ok(`成功收到非流式回复（${content.length} 字）：${JSON.stringify(content)}`);
  if (usage) {
    info(`usage: prompt_tokens=${usage.prompt_tokens}  completion_tokens=${usage.completion_tokens}  total=${usage.total_tokens}`);
  }
  return true;
}

/* =========================================================
 *  Test 2: 流式 SSE 请求
 * ======================================================= */
async function test2Streaming() {
  const n = section("流式 SSE chat/completions (stream=true) — 逐 token 输出");
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const payload = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: "你是友好的测试助手，回答简洁。" },
      { role: "user", content: "用 60 字以内介绍一下 JavaScript。" },
    ],
    temperature: 0.2,
    max_tokens: 300,
    stream: true,
  };

  info(`POST ${url}`);
  info(`model: ${payload.model}`);
  hr();

  let res;
  const t0 = Date.now();
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    fail(`网络层失败：${e.name}: ${e.message}`);
    return false;
  }
  const ttfb = Date.now() - t0;
  info(`HTTP ${res.status} ${res.statusText} | TTFB ${ttfb}ms`);

  if (!res.ok) {
    const raw = await res.text();
    fail(`非 2xx 响应（前 800 字）：${raw.slice(0, 800)}`);
    try {
      const j = JSON.parse(raw);
      if (j?.error) info(`错误字段: code=${j.error.code}  message=${j.error.message}`);
    } catch (_) {}
    return false;
  }

  if (!res.body) {
    fail("响应体为空，无法读取 SSE");
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let chunks = 0;
  let tokens = 0;
  let fullText = "";
  let firstTokenAt = null;
  let seenDone = false;

  process.stdout.write("  token 流: ");

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks += 1;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of rawEvent.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === "[DONE]") {
            seenDone = true;
            continue;
          }
          try {
            const payload = JSON.parse(data);
            const delta = payload?.choices?.[0]?.delta?.content;
            if (delta && typeof delta === "string") {
              if (firstTokenAt === null) firstTokenAt = Date.now() - t0;
              tokens += 1;
              fullText += delta;
              process.stdout.write(delta.replace(/\n/g, "\\n"));
            }
          } catch (e) {
            // 单条解析失败不影响整体
          }
        }
      }
    }
    buffer += decoder.decode();
  } catch (e) {
    fail(`读取 SSE 过程异常：${e.name}: ${e.message}`);
    return false;
  } finally {
    reader.releaseLock?.();
    process.stdout.write("\n");
  }

  const totalDur = Date.now() - t0;
  hr();

  if (tokens === 0) {
    fail(`0 个 token 被解析到。请检查 data: 行格式是否为 OpenAI SSE 兼容。首块 buffer 前 400 字：${buffer.slice(0, 400)}`);
    return false;
  }
  if (!seenDone) {
    info("⚠️  未收到 [DONE] 结束信号（某些代理/中转可能省略，不影响 token 已完整）");
  }

  ok(`流式成功：${tokens} 个 token | ${chunks} 个 SSE 块 | 首 token ${firstTokenAt}ms | 总耗时 ${totalDur}ms`);
  info(`完整回复（${fullText.length} 字）：${JSON.stringify(fullText)}`);
  return true;
}

/* =========================================================
 *  Test 3: 故意使用错误 Key —— 验证错误解析链路正常
 * ======================================================= */
async function test3InvalidKey() {
  const n = section("错误鉴权测试（验证 401 / invalid_api_key 解析）");
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
  info(`POST ${url}  |  使用故意错误的 Key  sk-INVALID-XXXX`);
  hr();

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer sk-INVALID-TEST-KEY-123456",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
        stream: false,
      }),
    });
  } catch (e) {
    // 这里网络失败也算「鉴权链路未触发」，不算 PASS
    fail(`网络层失败，无法验证鉴权：${e.name}: ${e.message}`);
    return false;
  }

  const raw = await res.text();
  info(`HTTP ${res.status} ${res.statusText}`);

  if (res.ok) {
    fail("预期返回非 2xx，但实际拿到 2xx —— 错误 Key 居然通过了鉴权！");
    return false;
  }

  try {
    const j = JSON.parse(raw);
    const err = j?.error;
    if (err?.code && err?.message) {
      ok(`错误结构解析成功：code=${err.code}  message=${err.message.slice(0, 120)}`);
      info(`⚠️  如果 code 是 'invalid_api_key' / 'authentication_error' / 401 则符合预期`);
      return true;
    }
  } catch (_) {}

  info(`原始响应（前 600 字）：${raw.slice(0, 600)}`);
  fail("响应不是 { error: { code, message } } 结构 —— route.ts 的 extractDeepSeekError 需要做兼容兜底");
  return false;
}

/* =========================================================
 *  Main
 * ======================================================= */
async function main() {
  const start = Date.now();
  const title = "DeepSeek API 连通性测试 · 完整报告";
  console.log("=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
  console.log(`时间: ${new Date().toLocaleString("zh-CN")}`);
  console.log(`平台: ${os.platform()} ${os.arch()}  |  Node ${process.version}`);
  console.log(`env.local: ${ENV_LOCAL}  ${fs.existsSync(ENV_LOCAL) ? "(已读取)" : "(未找到，读取 process.env)"}`);
  console.log(`BASE_URL: ${DEEPSEEK_BASE_URL}`);
  console.log(`MODEL:    ${DEEPSEEK_MODEL}`);
  console.log(`API Key:  ${DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.slice(0, 6) + "..." + DEEPSEEK_API_KEY.slice(-4) : "(未配置)"}`);

  // —— 空 Key 防护：提前报出配置方法，避免把"空字符串鉴权失败"误判成网络问题
  if (!DEEPSEEK_API_KEY) {
    console.log("\n");
    console.log("⛔  DEEPSEEK_API_KEY 为空 —— 请先按下面任一方式配置（Key 不会进入 Git 仓库）：");
    console.log("");
    console.log("   方案 A · 本机调试（推荐，与 Next.js 共用同一个文件）：");
    console.log(`     在 shenzhi 目录新建/编辑 .env.local，加入一行：`);
    console.log(`       DEEPSEEK_API_KEY=你的真实Key（sk-开头，从 https://platform.deepseek.com/api_keys 获取）`);
    console.log("");
    console.log("   方案 B · 临时 shell 注入：");
    console.log(`     PowerShell:  $env:DEEPSEEK_API_KEY="sk-xxxx" ; node test_deepseek_connectivity.mjs`);
    console.log(`     CMD:         set DEEPSEEK_API_KEY=sk-xxxx && node test_deepseek_connectivity.mjs`);
    console.log("");
    console.log(`   方案 C · CI/CD：把 DEEPSEEK_API_KEY 加入 GitHub Secrets / 平台环境变量，本脚本通过 process.env 自动读取。`);
    console.log("=".repeat(72));
    process.exitCode = 2;
    return;
  }

  const r1 = await test1NonStreaming();
  await sleep(600);
  const r2 = await test2Streaming();
  await sleep(600);
  const r3 = await test3InvalidKey();

  hr();
  const total = Date.now() - start;
  const pass = [r1, r2, r3].filter(Boolean).length;
  const allPass = pass === 3;
  console.log(`\n📊  总计 3 项，通过 ${pass}/3  |  总耗时 ${total}ms`);
  if (allPass) {
    console.log("🎉  全部通过！DeepSeek API 连通性正常，可进入下一步启动 Next.js 做端到端验证。");
  } else {
    console.log("⚠️  有项目未通过，请根据上方 ❌ 原因排查（最常见是 Key 错误 / 代理阻断 / 网络不可达）。");
  }
  process.exitCode = allPass ? 0 : 1;
}

main().catch((e) => {
  console.error("\n🔥 测试脚本未捕获异常：", e);
  process.exit(1);
});
