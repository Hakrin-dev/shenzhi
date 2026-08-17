/**
 * AI 搜索错误码表（严格对齐 A 模块 AI搜索-开发文档.md §8）
 * 服务端 SSE error 事件的 code 字段就是这里的字符串。
 * B 模块前端展示给用户的文案必须从这里取值，不能私自写字符串，
 * 否则 A/B/C 三方文案会出现不一致。
 */

export const AI_ERROR_HINTS: Record<
  string,
  { title: string; action?: string; tone?: "danger" | "warn" | "info" }
> = {
  "20001": {
    title: "请输入 2000 字以内的问题",
    action: "当前输入已超限，请删除部分内容后再发送。",
    tone: "warn",
  },
  "20002": {
    title: "今日次数已用完，订阅可解锁更多额度",
    action:
      "可前往「设置 → 订阅」解锁订阅用户额度，或在「设置 → API Key」处自行配置大模型接入。",
    tone: "warn",
  },
  "20003": {
    title: "当前有正在生成的回答，请稍候",
    action: "如果不需要当前回答，可以点击「停止」按钮后再发送新问题。",
    tone: "info",
  },
  "20004": {
    title: "生成中断，点击继续",
    action: "网络波动或模型服务短时不可用导致中断，点击消息下方的「继续」按钮可从断点恢复生成。",
    tone: "warn",
  },
  "20005": {
    title: "未找到足够相关的文献，建议换个问法或开启联网搜索",
    action: "可尝试：① 精简关键词；② 切换为英文术语；③ 打开 Composer 左下角「联网搜索」再试。",
    tone: "info",
  },
  "20006": {
    title: "单文件不超过 20MB，单次最多 5 个",
    action: "请缩小文件体积或减少数量后重新上传；PDF 建议先去除高清图片冗余。",
    tone: "warn",
  },
  "20007": {
    title: "部分附件解析失败，已从本次提问中移除",
    action: "可以重新上传格式正确的附件；若问题仍然存在，请联系 C 模块检查附件解析管道状态。",
    tone: "warn",
  },
  "20008": {
    title: "该问题暂无法回答",
    action: "该内容触发安全规则或超出当前模型能力范围。请换一种提问方式或精简问题描述。",
    tone: "danger",
  },
  "20009": {
    title: "当前模型需要订阅或在设置页配置 API Key",
    action:
      "切换到「默认模型」即可免费使用；或前往「设置」→「API Key」配置个人模型密钥后再使用订阅/API接入模型。",
    tone: "warn",
  },
  "20010": {
    title: "该分享已失效",
    action: "分享链接的访问次数或有效时间已用尽，请让分享者重新生成新链接。",
    tone: "danger",
  },
  /* ---- B 模块旧版非 A 标准错误码（向后兼容，不影响联调） ---- */
  NGROK_INTERCEPT: {
    title: "ngrok 免费版拦截了 AI 请求（返回 HTML 警告页）",
    action:
      "修复步骤：① 浏览器新开标签访问一次 ngrok 地址并点击「Visit Site」放行；② 确保请求头携带 ngrok-skip-browser-warning: true（本项目 lib/request.ts 已自动注入）；③ 重发即可。",
    tone: "danger",
  },
  NGROK_403: {
    title: "ngrok 返回 403 禁止访问",
    action:
      "通常是浏览器未放行拦截页。请先打开一次 A 同学提供的 ngrok 首页手动放行，再回到本页重试；仍失败请让 A 重新生成 ngrok 地址。",
    tone: "danger",
  },
  TIMEOUT: {
    title: "AI 响应超时（60s 未收到首 token）",
    action: "检查网络是否正常；或模型服务当前过载，请稍后再试。",
    tone: "warn",
  },
  RATE_LIMITED: {
    title: "请求被限流",
    action: "请降低提问频率或更换更大额度的 API Key，稍后重试。",
    tone: "warn",
  },
  SCHEMA_ERROR: {
    title: "请求字段校验失败（联调契约不一致）",
    action:
      "A/B/C 三模块字段命名未对齐，请同步 types/ai-search.ts 中 CreateChatSessionRequest 结构体后重试。",
    tone: "danger",
  },
  INVALID_JSON: {
    title: "请求体 JSON 解析失败",
    action: "检查是否携带 Content-Type: application/json，以及 body 是否为合法 JSON。",
    tone: "danger",
  },
  MODEL_CRASH: {
    title: "模型调用内部异常",
    action: "请稍后重试；若持续失败请联系 B 模块负责人排查后端模型服务状态。",
    tone: "danger",
  },
  REQUEST_FAILED: {
    title: "请求失败（未知错误）",
    action: "打开浏览器 DevTools → Network 查看具体请求状态，或点击重试。",
    tone: "danger",
  },
};

/** 查不到错误码时的兜底文案 */
export const DEFAULT_ERROR_HINT = AI_ERROR_HINTS.REQUEST_FAILED;

/** 把任意错误归一化为 { code, title, action } */
export function normalizeAIError(err: {
  code?: string | number;
  message?: string;
}): { code: string; title: string; action?: string } {
  const code = String(err.code ?? "REQUEST_FAILED");
  const hint = AI_ERROR_HINTS[code] ?? DEFAULT_ERROR_HINT;
  return {
    code,
    title: hint.title,
    action: hint.action,
  };
}
