"""HTTP boundary for the external knowledge-base service.

Only this module knows the upstream paths and transport details.  Callers
receive safe, classified errors and a small amount of raw JSON for the
adapter; upstream error bodies are never propagated.
"""

from __future__ import annotations

import os
from typing import Any, Mapping

import httpx

from app.schemas.knowledge import KnowledgeError


DEFAULT_TIMEOUT_SECONDS = 30.0


def _configured_timeout() -> float:
    raw = os.getenv('KNOWLEDGE_BASE_TIMEOUT_SEC', str(DEFAULT_TIMEOUT_SECONDS)).strip()
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS
    return value if value > 0 else DEFAULT_TIMEOUT_SECONDS


class KnowledgeClientError(Exception):
    """Safe classified failure raised by :class:`KnowledgeBaseClient`."""

    def __init__(self, error: KnowledgeError | str, status_code: int = 503):
        if isinstance(error, str):
            # This form is useful to callers that provide a fake adapter in
            # tests; the original text is intentionally not exposed.
            error = KnowledgeError(
                code='UPSTREAM_UNAVAILABLE',
                message='知识底座暂不可用',
                retryable=True,
                request_id='',
            )
        super().__init__(error.message)
        self.error = error
        self.status_code = status_code


class KnowledgeBaseClient:
    """Small async client for the three Phase 1 upstream endpoints."""

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

    async def search(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        """POST an already-adapted upstream search payload.

        Field translation belongs to the adapter.  This client intentionally
        knows only the transport path and response envelope.
        """
        body = await self._request_json(
            'POST', '/api/retrieval/search', json=dict(payload)
        )
        if not isinstance(body.get('results'), list):
            raise self._contract_error('search response results must be a list')
        return body

    async def paper(self, paper_id: str) -> dict[str, Any]:
        # The caller must pass the opaque paper_id returned by retrieval/search.
        # Conference-browser paper_id values are not canonical KG identifiers
        # and are intentionally not resolved here.
        body = await self._request_json(
            'GET', '/api/kg/paper', params={'paperId': paper_id}
        )
        if not isinstance(body.get('paper_id'), str) or not body['paper_id'].strip():
            raise self._contract_error('paper response is missing paper_id')
        return body

    async def graph(self, paper_id: str, depth: int = 1) -> dict[str, Any]:
        body = await self._request_json(
            'GET', '/api/kg/graph', params={'paperId': paper_id, 'depth': depth}
        )
        if not isinstance(body.get('rootId'), str) or not body['rootId'].strip():
            raise self._contract_error('graph response is missing rootId')
        if not isinstance(body.get('nodes'), list) or not isinstance(body.get('lines'), list):
            raise self._contract_error('graph response nodes/lines must be lists')
        return body

    async def _request_json(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self.base_url:
            raise KnowledgeClientError(
                KnowledgeError(
                    code='UPSTREAM_UNAVAILABLE',
                    message='知识底座未配置',
                    retryable=False,
                    request_id='',
                ),
                status_code=503,
            )

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                transport=self.transport,
            ) as client:
                response = await client.request(method, f'{self.base_url}{path}', **kwargs)
        except httpx.TimeoutException as exc:
            raise KnowledgeClientError(
                KnowledgeError(
                    code='TIMEOUT',
                    message='知识底座请求超时',
                    retryable=True,
                    request_id='',
                ),
                status_code=504,
            ) from exc
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            raise KnowledgeClientError(
                KnowledgeError(
                    code='UPSTREAM_UNAVAILABLE',
                    message='知识底座暂不可用',
                    retryable=True,
                    request_id='',
                ),
                status_code=503,
            ) from exc
        except (httpx.InvalidURL, httpx.UnsupportedProtocol) as exc:
            raise KnowledgeClientError(
                KnowledgeError(
                    code='UPSTREAM_UNAVAILABLE',
                    message='知识底座配置无效',
                    retryable=False,
                    request_id='',
                ),
                status_code=503,
            ) from exc
        except httpx.HTTPError as exc:
            raise KnowledgeClientError(
                KnowledgeError(
                    code='UPSTREAM_UNAVAILABLE',
                    message='知识底座请求失败',
                    retryable=True,
                    request_id='',
                ),
                status_code=503,
            ) from exc

        if response.status_code >= 400:
            raise self._status_error(response.status_code)

        try:
            body = response.json()
        except (TypeError, ValueError) as exc:
            raise self._contract_error('knowledge-base response is not valid JSON') from exc
        if not isinstance(body, dict):
            raise self._contract_error('knowledge-base response must be a JSON object')
        return body

    @staticmethod
    def _status_error(status_code: int) -> KnowledgeClientError:
        if status_code == 400:
            code, message, retryable, public_status = (
                'INVALID_ARGUMENT', '知识底座拒绝了请求', False, 400
            )
        elif status_code == 404:
            code, message, retryable, public_status = (
                'NOT_FOUND', '知识底座资源不存在', False, 404
            )
        elif status_code == 429:
            code, message, retryable, public_status = (
                'RATE_LIMITED', '知识底座请求过于频繁', True, 429
            )
        elif status_code >= 500:
            code, message, retryable, public_status = (
                'UPSTREAM_UNAVAILABLE', '知识底座暂不可用', True, 503
            )
        else:
            code, message, retryable, public_status = (
                'UPSTREAM_UNAVAILABLE', '知识底座请求失败', True, 502
            )
        return KnowledgeClientError(
            KnowledgeError(code=code, message=message, retryable=retryable, request_id=''),
            status_code=public_status,
        )

    @staticmethod
    def _contract_error(_detail: str) -> KnowledgeClientError:
        # ``_detail`` is deliberately ignored: it may contain an upstream
        # response fragment or another value that should not reach clients.
        return KnowledgeClientError(
            KnowledgeError(
                code='CONTRACT_VIOLATION',
                message='知识底座返回格式无效',
                retryable=False,
                request_id='',
            ),
            status_code=502,
        )
