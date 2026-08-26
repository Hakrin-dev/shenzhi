/**
 * 验证 Tavily 联网搜索（读取 .env.local 的 TAVILY_API_KEY）
 * 用法：node scripts/test-tavily-search.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = readFileSync(resolve(root, ".env.local"), "utf8");
const key = envLocal.match(/^TAVILY_API_KEY=(.+)$/m)?.[1]?.trim();

if (!key) {
  console.error("未配置 TAVILY_API_KEY");
  process.exit(1);
}

const res = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: key,
    query: "2026 AI agent web search",
    max_results: 3,
    search_depth: "advanced",
  }),
});

console.log("HTTP", res.status);
const json = await res.json();
if (!res.ok) {
  console.error("失败:", json.detail ?? json.error ?? json);
  process.exit(1);
}
console.log("结果数:", json.results?.length ?? 0);
for (const r of json.results ?? []) {
  console.log("-", r.title?.slice(0, 60));
}
console.log("Tavily 联网搜索 OK");
