"""知识底座科研组 API Client。

职责：怎么调用知识底座科研 API —— 地址、HTTP 请求、Header、Timeout、Retry 等。
真实的 HTTP 客户端在 HTTPKnowledgeApiClient；Mock 实现位于 mock_data.py。
两者实现同一 KnowledgeApiClient 接口，由 __init__.py 的工厂按配置选择。

当前阶段真实接口尚未接入，默认使用 MockKnowledgeApiClient（见 __init__.py）。
"""
from __future__ import annotations

import asyncio
import os
from abc import ABC, abstractmethod
from typing import Any

import httpx

from .exceptions import map_http_error
from .schemas import (
    KnowledgeGraphResponse,
    KnowledgePaperDetail,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)

KNOWLEDGE_API_URL = os.getenv("KNOWLEDGE_API_URL", "").rstrip("/")
KNOWLEDGE_API_TIMEOUT = float(os.getenv("KNOWLEDGE_API_TIMEOUT_SEC", "15"))
KNOWLEDGE_API_MAX_RETRIES = int(os.getenv("KNOWLEDGE_API_MAX_RETRIES", "2"))

# 知识底座科研组 API 的错误 code 可接受集合（契约错误识别）
_KNOWN_ERROR_CODES = {
    "INVALID_ARGUMENT",
    "NOT_FOUND",
    "RATE_LIMITED",
    "UPSTREAM_UNAVAILABLE",
    "TIMEOUT",
    "CONTRACT_VIOLATION",
    "UNKNOWN",
}


class KnowledgeApiClient(ABC):
    """知识底座科研组 API 的抽象接口（真实 / Mock 共用）。

    端点与《论文检索与知识图谱 API 使用手册》对齐：
        search: POST /api/retrieval/search
        paper:  GET  /api/kg/paper?paperId=...
        graph:  GET  /api/kg/graph?paperId=...&depth=N
        health: GET  /api/health
    """

    @abstractmethod
    async def search(self, request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
        """论文检索（增强检索）。"""

    @abstractmethod
    async def paper(self, paper_id: str) -> KnowledgePaperDetail:
        """论文详情。paper_id 作为 opaque string 处理，禁止解析内部格式。"""

    @abstractmethod
    async def graph(self, paper_id: str, depth: int = 1) -> KnowledgeGraphResponse:
        """论文关系图谱。默认 depth=1（手册建议 1）。"""

    @abstractmethod
    async def health(self) -> dict[str, Any]:
        """服务状态检查（GET /api/health），不可用时抛 KnowledgeBaseError。"""


class HTTPKnowledgeApiClient(KnowledgeApiClient):
    """真实 HTTP 实现：通过 KNOWLEDGE_API_URL 访问知识底座科研组 API。"""

    def __init__(
        self,
        base_url: str = KNOWLEDGE_API_URL,
        timeout: float = KNOWLEDGE_API_TIMEOUT,
        max_retries: int = KNOWLEDGE_API_MAX_RETRIES,
    ) -> None:
        if not base_url:
            raise ValueError("HTTPKnowledgeApiClient 需要配置 KNOWLEDGE_API_URL")
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries

    async def _request_json(self, method: str, path: str, *, payload: dict | None = None) -> dict:
        url = f"{self.base_url}{path}"
        attempt = 0
        while True:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.request(method, url, json=payload)
                    response.raise_for_status()
                    body = response.json()
                if not isinstance(body, dict):
                    from .exceptions import KnowledgeBaseContractViolationError
                    raise KnowledgeBaseContractViolationError("知识底座返回非 JSON 对象")
                return body
            except httpx.HTTPError as exc:
                if attempt < self.max_retries and isinstance(
                    exc, (httpx.TimeoutException, httpx.TransportError)
                ):
                    attempt += 1
                    await asyncio.sleep(0.3 * attempt)
                    continue
                raise map_http_error(exc) from exc

    async def search(self, request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
        body = await self._request_json(
            "POST", "/api/retrieval/search", payload=request.model_dump()
        )
        try:
            return KnowledgeSearchResponse.model_validate(body)
        except Exception as exc:  # noqa: BLE001 - 契约校验失败统一转换
            from .exceptions import KnowledgeBaseContractViolationError
            raise KnowledgeBaseContractViolationError("检索响应不符合契约") from exc

    async def paper(self, paper_id: str) -> KnowledgePaperDetail:
        body = await self._request_json(
            "GET", f"/api/kg/paper?paperId={_quote(paper_id)}"
        )
        try:
            return KnowledgePaperDetail.model_validate(body)
        except Exception as exc:  # noqa: BLE001
            from .exceptions import KnowledgeBaseContractViolationError
            raise KnowledgeBaseContractViolationError("论文详情响应不符合契约") from exc

    async def graph(self, paper_id: str, depth: int = 1) -> KnowledgeGraphResponse:
        body = await self._request_json(
            "GET", f"/api/kg/graph?paperId={_quote(paper_id)}&depth={int(depth)}"
        )
        try:
            return KnowledgeGraphResponse.model_validate(body)
        except Exception as exc:  # noqa: BLE001
            from .exceptions import KnowledgeBaseContractViolationError
            raise KnowledgeBaseContractViolationError("图谱响应不符合契约") from exc

    async def health(self) -> dict[str, Any]:
        body = await self._request_json("GET", "/api/health")
        return body


def _quote(value: str) -> str:
    from urllib.parse import quote

    return quote(str(value), safe="")


__all__ = [
    "KnowledgeApiClient",
    "HTTPKnowledgeApiClient",
    "KNOWLEDGE_API_URL",
    "KNOWLEDGE_API_TIMEOUT",
    "KNOWLEDGE_API_MAX_RETRIES",
    "_KNOWN_ERROR_CODES",
]
