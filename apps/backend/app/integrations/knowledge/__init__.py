"""知识底座集成层（integrations/knowledge）。

统一对外暴露知识底座科研组能力的 Client 工厂与相关类型。

文件职责：
    client.py      调用科研 API：地址 / HTTP / Header / Timeout / Retry（对照使用手册）
    schemas.py     科研 API 自己的输入输出格式（检索/详情 snake_case；图谱 rootId+lines）
    adapter.py     科研数据 → 深知业务数据（camelCase 契约，conference→venue、lines→edges）
    exceptions.py  知识底座调用异常定义与转换
    mock_data.py   Mock 数据源与 Mock 客户端（真实接口接入前的降级实现）
"""
from __future__ import annotations

from .adapter import adapt_graph, adapt_paper_detail, adapt_search_response
from .client import (
    KNOWLEDGE_API_MAX_RETRIES,
    KNOWLEDGE_API_TIMEOUT,
    KNOWLEDGE_API_URL,
    HTTPKnowledgeApiClient,
    KnowledgeApiClient,
)
from .exceptions import (
    KnowledgeBaseContractViolationError,
    KnowledgeBaseError,
    KnowledgeBaseInvalidArgumentError,
    KnowledgeBaseNotFoundError,
    KnowledgeBaseRateLimitedError,
    KnowledgeBaseTimeoutError,
    KnowledgeBaseUnavailableError,
    KnowledgeBaseUnknownError,
    map_http_error,
)
from .mock_data import MockKnowledgeApiClient

__all__ = [
    "KnowledgeApiClient",
    "HTTPKnowledgeApiClient",
    "MockKnowledgeApiClient",
    "get_knowledge_api",
    # 适配器
    "adapt_search_response",
    "adapt_paper_detail",
    "adapt_graph",
    # 异常
    "KnowledgeBaseError",
    "KnowledgeBaseInvalidArgumentError",
    "KnowledgeBaseNotFoundError",
    "KnowledgeBaseRateLimitedError",
    "KnowledgeBaseUnavailableError",
    "KnowledgeBaseTimeoutError",
    "KnowledgeBaseContractViolationError",
    "KnowledgeBaseUnknownError",
    "map_http_error",
    # 配置
    "KNOWLEDGE_API_URL",
    "KNOWLEDGE_API_TIMEOUT",
    "KNOWLEDGE_API_MAX_RETRIES",
]


def get_knowledge_api() -> KnowledgeApiClient:
    """返回知识底座 Client。

    配置 KNOWLEDGE_API_URL 后走真实 HTTP 实现；未配置（当前阶段）使用 Mock，
    保证前后端在真实接口接入前即可联调页面与交互。
    """
    if not KNOWLEDGE_API_URL:
        return MockKnowledgeApiClient()
    return HTTPKnowledgeApiClient(
        base_url=KNOWLEDGE_API_URL,
        timeout=KNOWLEDGE_API_TIMEOUT,
        max_retries=KNOWLEDGE_API_MAX_RETRIES,
    )
