import { KnowledgeClientError } from "../../clients/knowledge";

/** Knowledge 请求最多额外重试一次；UNKNOWN 也不能绕过这一上限。 */
export const KNOWLEDGE_MAX_RETRIES = 1;

export function knowledgeQueryRetry(failureCount: number, error: unknown): boolean {
  return (
    failureCount < KNOWLEDGE_MAX_RETRIES &&
    error instanceof KnowledgeClientError &&
    error.retryable
  );
}
