import { ApiError } from "@/lib/api/http";

const MESSAGES: Record<number, string> = {
  20001: "请输入 2000 字以内的问题",
  20002: "今日次数已用完,订阅可解锁更多额度",
  20003: "当前有正在生成的回答,请稍候",
  20004: "生成中断,点击继续",
  20005: "未找到足够相关的文献,建议换个问法或开启联网搜索",
  20006: "单文件不超过 20MB,单次最多 5 个",
  20007: "部分附件解析失败,已从本次提问中移除",
  20008: "该问题暂无法回答",
  20009: "当前模型需要订阅或在设置页配置 API Key",
  20010: "该分享已失效",
};

export function messageForApiError(error: unknown) {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return "生成服务暂不可用";
}
