"""Safe failures raised inside the external Knowledge integration."""

from __future__ import annotations


class KnowledgeIntegrationError(Exception):
    """Classified integration failure with no upstream payload attached."""

    def __init__(self, code: str, message: str, retryable: bool, status_code: int):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.status_code = status_code

    @classmethod
    def not_configured(cls) -> 'KnowledgeIntegrationError':
        return cls('UPSTREAM_UNAVAILABLE', '知识底座未配置', False, 503)

    @classmethod
    def timeout(cls) -> 'KnowledgeIntegrationError':
        return cls('TIMEOUT', '知识底座请求超时', True, 504)

    @classmethod
    def connection_unavailable(cls) -> 'KnowledgeIntegrationError':
        return cls('UPSTREAM_UNAVAILABLE', '知识底座暂不可用', True, 503)

    @classmethod
    def invalid_configuration(cls) -> 'KnowledgeIntegrationError':
        return cls('UPSTREAM_UNAVAILABLE', '知识底座配置无效', False, 503)

    @classmethod
    def request_failed(cls) -> 'KnowledgeIntegrationError':
        return cls('UPSTREAM_UNAVAILABLE', '知识底座请求失败', True, 503)

    @classmethod
    def invalid_argument(cls) -> 'KnowledgeIntegrationError':
        return cls('INVALID_ARGUMENT', '知识底座拒绝了请求', False, 400)

    @classmethod
    def not_found(cls) -> 'KnowledgeIntegrationError':
        return cls('NOT_FOUND', '知识底座资源不存在', False, 404)

    @classmethod
    def rate_limited(cls) -> 'KnowledgeIntegrationError':
        return cls('RATE_LIMITED', '知识底座请求过于频繁', True, 429)

    @classmethod
    def contract_violation(cls) -> 'KnowledgeIntegrationError':
        return cls('CONTRACT_VIOLATION', '知识底座返回格式无效', False, 502)
