"""HTTP transport boundary for the external Knowledge Base API."""

from __future__ import annotations

import os
from typing import Any, Mapping, cast

import httpx

from app.integrations.knowledge.exceptions import KnowledgeIntegrationError
from app.integrations.knowledge.schemas import (
    UpstreamGraphResponse,
    UpstreamPaperResponse,
    UpstreamSearchResponse,
)


DEFAULT_TIMEOUT_SECONDS = 30.0


def _configured_timeout() -> float:
    raw = os.getenv('KNOWLEDGE_BASE_TIMEOUT_SEC', str(DEFAULT_TIMEOUT_SECONDS)).strip()
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS
    return value if value > 0 else DEFAULT_TIMEOUT_SECONDS


class KnowledgeBaseClient:
    """Async transport client for the three existing upstream endpoints."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout: float | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        configured = base_url if base_url is not None else os.getenv('KNOWLEDGE_BASE_API_URL', '')
        self.base_url = configured.strip().rstrip('/')
        self.timeout = timeout if timeout is not None and timeout > 0 else _configured_timeout()
        self.transport = transport

    async def search(self, payload: Mapping[str, Any]) -> UpstreamSearchResponse:
        """POST an already-adapted upstream search payload."""
        body = await self._request_json(
            'POST', '/api/retrieval/search', json=dict(payload)
        )
        if not isinstance(body.get('results'), list):
            raise KnowledgeIntegrationError.contract_violation()
        return cast(UpstreamSearchResponse, body)

    async def paper(self, paper_id: str) -> UpstreamPaperResponse:
        """GET an upstream paper detail using an opaque paper ID."""
        body = await self._request_json(
            'GET', '/api/kg/paper', params={'paperId': paper_id}
        )
        if not isinstance(body.get('paper_id'), str) or not body['paper_id'].strip():
            raise KnowledgeIntegrationError.contract_violation()
        return cast(UpstreamPaperResponse, body)

    async def graph(self, paper_id: str, depth: int = 1) -> UpstreamGraphResponse:
        """GET an upstream paper graph using an opaque paper ID."""
        body = await self._request_json(
            'GET', '/api/kg/graph', params={'paperId': paper_id, 'depth': depth}
        )
        if not isinstance(body.get('rootId'), str) or not body['rootId'].strip():
            raise KnowledgeIntegrationError.contract_violation()
        if not isinstance(body.get('nodes'), list) or not isinstance(body.get('lines'), list):
            raise KnowledgeIntegrationError.contract_violation()
        return cast(UpstreamGraphResponse, body)

    async def _request_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self.base_url:
            raise KnowledgeIntegrationError.not_configured()

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                transport=self.transport,
            ) as client:
                response = await client.request(method, f'{self.base_url}{path}', **kwargs)
        except httpx.TimeoutException as exc:
            raise KnowledgeIntegrationError.timeout() from exc
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            raise KnowledgeIntegrationError.connection_unavailable() from exc
        except (httpx.InvalidURL, httpx.UnsupportedProtocol) as exc:
            raise KnowledgeIntegrationError.invalid_configuration() from exc
        except httpx.HTTPError as exc:
            raise KnowledgeIntegrationError.request_failed() from exc

        if response.status_code >= 400:
            raise self._status_error(response.status_code)

        try:
            body = response.json()
        except (TypeError, ValueError) as exc:
            raise KnowledgeIntegrationError.contract_violation() from exc
        if not isinstance(body, dict):
            raise KnowledgeIntegrationError.contract_violation()
        return body

    @staticmethod
    def _status_error(status_code: int) -> KnowledgeIntegrationError:
        if status_code == 400:
            return KnowledgeIntegrationError.invalid_argument()
        if status_code == 404:
            return KnowledgeIntegrationError.not_found()
        if status_code == 429:
            return KnowledgeIntegrationError.rate_limited()
        if status_code >= 500:
            return KnowledgeIntegrationError(
                'UPSTREAM_UNAVAILABLE', '知识底座暂不可用', True, 503
            )
        return KnowledgeIntegrationError(
            'UPSTREAM_UNAVAILABLE', '知识底座请求失败', True, 502
        )
