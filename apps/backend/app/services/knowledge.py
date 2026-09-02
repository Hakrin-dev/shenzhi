"""知识底座业务服务。

承载「论文搜索 / 论文详情 / 论文关系图谱」的业务编排：
调用 integrations/knowledge 的 Client，把科研侧数据适配为深知业务格式，
并把知识底座异常转换为业务层 BusinessError（统一数字错误码 + HTTP 状态）。

当前阶段使用 Mock Client；配置 KNOWLEDGE_API_URL 后自动切换到真实实现。
"""
from __future__ import annotations

from typing import Any

from app.core.errors import BusinessError
from app.integrations.knowledge import (
    KnowledgeBaseContractViolationError,
    KnowledgeBaseError,
    KnowledgeBaseInvalidArgumentError,
    KnowledgeBaseNotFoundError,
    KnowledgeBaseRateLimitedError,
    KnowledgeBaseTimeoutError,
    KnowledgeBaseUnavailableError,
    adapt_graph,
    adapt_paper_detail,
    adapt_search_response,
    get_knowledge_api,
)
from app.integrations.knowledge.schemas import KnowledgeSearchRequest

# 知识底座错误类别 → 深知业务错误码
_KNOWLEDGE_ERROR_CODE_MAP: dict[str, int] = {
    "INVALID_ARGUMENT": 21001,
    "NOT_FOUND": 21002,
    "RATE_LIMITED": 21003,
    "UPSTREAM_UNAVAILABLE": 21004,
    "TIMEOUT": 21005,
    "CONTRACT_VIOLATION": 21006,
    "UNKNOWN": 21007,
}

_ERROR_MESSAGE: dict[str, str] = {
    "INVALID_ARGUMENT": "检索参数不合法",
    "NOT_FOUND": "未找到对应论文或节点",
    "RATE_LIMITED": "知识底座请求过于频繁，请稍后重试",
    "UPSTREAM_UNAVAILABLE": "知识底座服务暂不可用",
    "TIMEOUT": "知识底座服务响应超时",
    "CONTRACT_VIOLATION": "知识底座返回数据异常",
    "UNKNOWN": "知识底座服务异常",
}

# 异常类 → 语义化类别（供精确转换）
_EXCEPTION_TO_CODE: dict[type[KnowledgeBaseError], str] = {
    KnowledgeBaseInvalidArgumentError: "INVALID_ARGUMENT",
    KnowledgeBaseNotFoundError: "NOT_FOUND",
    KnowledgeBaseRateLimitedError: "RATE_LIMITED",
    KnowledgeBaseUnavailableError: "UPSTREAM_UNAVAILABLE",
    KnowledgeBaseTimeoutError: "TIMEOUT",
    KnowledgeBaseContractViolationError: "CONTRACT_VIOLATION",
}


def _to_business_error(error: KnowledgeBaseError) -> BusinessError:
    """知识底座异常 → 深知业务异常（保留类别与 HTTP 状态）。"""
    category = _EXCEPTION_TO_CODE.get(type(error), error.code)
    code = _KNOWLEDGE_ERROR_CODE_MAP.get(category, 21007)
    message = error.message or _ERROR_MESSAGE.get(category, "知识底座服务异常")
    return BusinessError(code, message, error.status)


def _guard(error: KnowledgeBaseError) -> None:
    raise _to_business_error(error) from error


async def knowledge_search(
    query: str,
    *,
    top_k: int = 10,
    year_from: int | None = None,
    year_to: int | None = None,
    venue: list[str] | None = None,
    author: list[str] | None = None,
    keyword: list[str] | None = None,
    subject: list[str] | None = None,
) -> dict[str, Any]:
    """论文搜索。返回深知业务格式：{results: [...]}。"""
    text = query.strip()
    if not text:
        return {"results": []}

    request = KnowledgeSearchRequest(
        query=text,
        top_k=min(max(top_k, 1), 50),
        year_gte=year_from,
        year_lte=year_to,
        # 深知业务侧统一用 venue 语义，转为上游接口的 conference 筛选字段
        conference=venue or [],
        author=author or [],
        keyword=keyword or [],
        subject=subject or [],
    )
    client = get_knowledge_api()
    try:
        response = await client.search(request)
    except KnowledgeBaseError as error:
        _guard(error)
    return adapt_search_response(response)


async def knowledge_paper_detail(paper_id: str) -> dict[str, Any]:
    """论文详情。paper_id 作为 opaque string 使用。"""
    client = get_knowledge_api()
    try:
        detail = await client.paper(paper_id)
    except KnowledgeBaseError as error:
        _guard(error)
    return adapt_paper_detail(detail)


async def knowledge_graph(paper_id: str, depth: int = 1) -> dict[str, Any]:
    """论文关系图谱。默认 depth=1，避免 depth=2 返回过大图。"""
    client = get_knowledge_api()
    try:
        graph = await client.graph(paper_id, depth=max(1, int(depth)))
    except KnowledgeBaseError as error:
        _guard(error)
    return adapt_graph(graph)
