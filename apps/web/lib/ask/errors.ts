import { ApiError } from "@/lib/api/http";

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
    action:
      "网络波动或模型服务短时不可用导致中断，点击消息下方的「继续」按钮可从断点恢复生成。",
    tone: "warn",
  },
  "20005": {
    title: "未找到足够相关的文献，建议换个问法或开启联网搜索",
    action:
      "可尝试：① 精简关键词；② 切换为英文术语；③ 打开 Composer 左下角「联网搜索」再试。",
    tone: "info",
  },
  "20006": {
    title: "单文件不超过 20MB，单次最多 5 个",
    action: "请缩小文件体积或减少数量后重新上传。",
    tone: "warn",
  },
  "20007": {
    title: "部分附件解析失败，已从本次提问中移除",
    tone: "warn",
  },
  "20008": {
    title: "该问题暂无法回答",
    tone: "danger",
  },
  "20009": {
    title: "当前模型需要订阅或在设置页配置 API Key",
    tone: "warn",
  },
  "20010": {
    title: "该分享已失效",
    tone: "danger",
  },
  NGROK_INTERCEPT: {
    title: "ngrok 免费版拦截了 AI 请求",
    tone: "danger",
  },
  TIMEOUT: {
    title: "AI 响应超时（60s 未收到首 token）",
    tone: "warn",
  },
  REQUEST_FAILED: {
    title: "请求失败（未知错误）",
    tone: "danger",
  },
};

export const DEFAULT_ERROR_HINT = AI_ERROR_HINTS.REQUEST_FAILED;

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

const NUMERIC_MESSAGES: Record<number, string> = {
  20001: AI_ERROR_HINTS["20001"].title,
  20002: AI_ERROR_HINTS["20002"].title,
  20003: AI_ERROR_HINTS["20003"].title,
  20004: AI_ERROR_HINTS["20004"].title,
  20005: AI_ERROR_HINTS["20005"].title,
  20006: AI_ERROR_HINTS["20006"].title,
  20007: AI_ERROR_HINTS["20007"].title,
  20008: AI_ERROR_HINTS["20008"].title,
  20009: AI_ERROR_HINTS["20009"].title,
  20010: AI_ERROR_HINTS["20010"].title,
};

export function messageForApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NUMERIC_MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return "生成服务暂不可用";
}
