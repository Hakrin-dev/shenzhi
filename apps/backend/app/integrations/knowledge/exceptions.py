"""知识底座调用相关异常定义与转换。

对外统一使用 KnowledgeErrorCode 描述失败类别，与前端 Contract 对齐：

    INVALID_ARGUMENT | NOT_FOUND | RATE_LIMITED | UPSTREAM_UNAVAILABLE
    | TIMEOUT | CONTRACT_VIOLATION | UNKNOWN
"""
from __future__ import annotations

from typing import Literal

import httpx

KnowledgeErrorCode = Literal[
    "INVALID_ARGUMENT",
    "NOT_FOUND",
    "RATE_LIMITED",
    "UPSTREAM_UNAVAILABLE",
    "TIMEOUT",
    "CONTRACT_VIOLATION",
    "UNKNOWN",
]


class KnowledgeBaseError(Exception):
    """知识底座调用失败的统一异常基类。"""

    code: KnowledgeErrorCode
    retryable: bool
    status: int

    def __init__(
        self,
        code: KnowledgeErrorCode,
        message: str,
        *,
        retryable: bool = False,
        status: int = 502,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.status = status


class KnowledgeBaseInvalidArgumentError(KnowledgeBaseError):
    def __init__(self, message: str = "请求参数不合法") -> None:
        super().__init__("INVALID_ARGUMENT", message, retryable=False, status=422)


class KnowledgeBaseNotFoundError(KnowledgeBaseError):
    def __init__(self, message: str = "未找到对应论文或节点") -> None:
        super().__init__("NOT_FOUND", message, retryable=False, status=404)


class KnowledgeBaseRateLimitedError(KnowledgeBaseError):
    def __init__(self, message: str = "知识底座请求过于频繁") -> None:
        super().__init__("RATE_LIMITED", message, retryable=True, status=429)


class KnowledgeBaseUnavailableError(KnowledgeBaseError):
    def __init__(self, message: str = "知识底座服务暂不可用") -> None:
        super().__init__("UPSTREAM_UNAVAILABLE", message, retryable=True, status=502)


class KnowledgeBaseTimeoutError(KnowledgeBaseError):
    def __init__(self, message: str = "知识底座服务响应超时") -> None:
        super().__init__("TIMEOUT", message, retryable=True, status=504)


class KnowledgeBaseContractViolationError(KnowledgeBaseError):
    def __init__(self, message: str = "知识底座返回数据不符合契约") -> None:
        super().__init__("CONTRACT_VIOLATION", message, retryable=False, status=502)


class KnowledgeBaseUnknownError(KnowledgeBaseError):
    def __init__(self, message: str = "知识底座未知错误") -> None:
        super().__init__("UNKNOWN", message, retryable=False, status=500)


def map_http_error(exc: httpx.HTTPError, message: str | None = None) -> KnowledgeBaseError:
    """把 HTTP 调用错误转换为知识底座统一异常。"""
    if isinstance(exc, httpx.TimeoutException):
        return KnowledgeBaseTimeoutError(message or "知识底座服务响应超时")
    if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
        return KnowledgeBaseUnavailableError(message or "无法连接知识底座服务")
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 404:
            return KnowledgeBaseNotFoundError(message or "未找到对应论文或节点")
        if status == 429:
            return KnowledgeBaseRateLimitedError(message or "知识底座请求过于频繁")
        if status == 408:
            return KnowledgeBaseTimeoutError(message or "知识底座服务响应超时")
        if 500 <= status < 600:
            return KnowledgeBaseUnavailableError(message or "知识底座服务暂不可用")
        return KnowledgeBaseUnknownError(message or f"知识底座调用失败（HTTP {status}）")
    return KnowledgeBaseUnknownError(message or f"知识底座调用失败：{exc}")
