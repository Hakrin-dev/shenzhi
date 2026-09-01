"""Knowledge-base adapter and external-to-domain mapping."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from pydantic import ValidationError

from app.clients.knowledge_base import KnowledgeBaseClient
from app.schemas.knowledge import (
    GraphEdge,
    GraphNode,
    KnowledgeError,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    PaperDetail,
    PaperGraph,
    PaperSearchResult,
    Provenance,
)


class KnowledgeServiceError(Exception):
    """A safe domain/contract error produced while adapting upstream data."""

    def __init__(self, error: KnowledgeError | str, status_code: int = 502):
        if isinstance(error, str):
            error = KnowledgeError(
                code='CONTRACT_VIOLATION',
                message='知识底座返回格式无效',
                retryable=False,
                request_id='',
            )
        super().__init__(error.message)
        self.error = error
        self.status_code = status_code


def _retrieved_at(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _provenance(external_id: str | None, retrieved_at: datetime | None) -> Provenance:
    return Provenance(
        provider='knowledge-base',
        external_id=external_id,
        retrieved_at=_retrieved_at(retrieved_at),
        source_version=None,
    )


def _required_string(item: dict[str, Any], key: str) -> str:
    value = item.get(key)
    if not isinstance(value, str) or not value.strip():
        raise KnowledgeServiceError('missing required string field')
    return value.strip()


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise KnowledgeServiceError('invalid optional string field')
    value = value.strip()
    return value or None


def _first_optional_string(item: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        if key in item:
            value = _optional_string(item.get(key))
            if value is not None:
                return value
    return None


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        raise KnowledgeServiceError('invalid string-list field')
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise KnowledgeServiceError('invalid string-list element')
        item = item.strip()
        if item:
            result.append(item)
    return result


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise KnowledgeServiceError('invalid integer field')
    return value


def _optional_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise KnowledgeServiceError('invalid numeric field')
    return float(value)


def _safe_property(value: Any) -> Any:
    """Normalize empty strings in graph properties without exposing styling."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    if isinstance(value, list):
        return [_safe_property(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _safe_property(item) for key, item in value.items()}
    return value


def _property_key(key: Any) -> str:
    aliases = {
        'conference': 'venue',
        'citeCount': 'citationCount',
        'citation_count': 'citationCount',
        'reference_count': 'referenceCount',
        'pdf_url': 'pdfUrl',
    }
    text = str(key)
    return aliases.get(text, text)


def _upstream_search_payload(request: KnowledgeSearchRequest) -> dict[str, Any]:
    """Translate the public request once at the anti-corruption boundary."""
    payload: dict[str, Any] = {
        'query': request.query,
        'top_k': request.top_k,
    }
    if request.year_from is not None:
        payload['year_gte'] = request.year_from
    if request.year_to is not None:
        payload['year_lte'] = request.year_to
    if request.venue:
        payload['conference'] = request.venue
    if request.author:
        payload['author'] = request.author
    if request.keyword:
        payload['keyword'] = request.keyword
    if request.subject:
        payload['subject'] = request.subject
    return payload


def _contract_model(factory: Callable[[], Any]) -> Any:
    try:
        return factory()
    except KnowledgeServiceError:
        raise
    except (TypeError, ValueError, ValidationError) as exc:
        raise KnowledgeServiceError('contract model validation failed') from exc


def map_search_result(
    item: dict[str, Any], *, retrieved_at: datetime | None = None
) -> PaperSearchResult:
    if not isinstance(item, dict):
        raise KnowledgeServiceError('search result must be an object')
    paper_id = _required_string(item, 'paper_id')
    title = _required_string(item, 'title')
    return _contract_model(lambda: PaperSearchResult(
        id=paper_id,
        title=title,
        abstract=_optional_string(item.get('abstract')),
        authors=_string_list(item.get('authors')),
        year=_optional_int(item.get('year')),
        venue=_first_optional_string(item, 'conference', 'venue'),
        keywords=_string_list(item.get('keywords')),
        subjects=_string_list(item.get('subjects')),
        score=_optional_number(item.get('score')),
        rank=_optional_int(item.get('rank')),
        provenance=_provenance(paper_id, retrieved_at),
    ))


def map_paper_detail(
    item: dict[str, Any], *, retrieved_at: datetime | None = None
) -> PaperDetail:
    if not isinstance(item, dict):
        raise KnowledgeServiceError('paper response must be an object')
    paper_id = _required_string(item, 'paper_id')
    title = _required_string(item, 'title')
    return _contract_model(lambda: PaperDetail(
        id=paper_id,
        title=title,
        abstract=_optional_string(item.get('abstract')),
        authors=_string_list(item.get('authors')),
        year=_optional_int(item.get('year')),
        venue=_first_optional_string(item, 'venue', 'conference'),
        doi=_optional_string(item.get('doi')),
        pdf_url=_first_optional_string(item, 'pdf_url', 'pdfUrl'),
        # The current detail endpoint does not return these fields.  An empty
        # list means no detail keywords/subjects were supplied; unknown counts
        # remain null rather than being presented as fabricated zeroes.
        keywords=_string_list(item.get('keywords')),
        subjects=_string_list(item.get('subjects')),
        citation_count=_optional_int(next((item[key] for key in (
            'citationCount', 'citation_count', 'citeCount', 'cite_count'
        ) if key in item), None)),
        reference_count=_optional_int(next((item[key] for key in (
            'referenceCount', 'reference_count'
        ) if key in item), None)),
        provenance=_provenance(paper_id, retrieved_at),
    ))


def _graph_node(
    item: dict[str, Any], *, retrieved_at: datetime | None = None
) -> GraphNode:
    if not isinstance(item, dict):
        raise KnowledgeServiceError('graph node must be an object')
    node_id = _required_string(item, 'id')
    data = item.get('data')
    if not isinstance(data, dict):
        raise KnowledgeServiceError('graph node data must be an object')
    kind = _first_optional_string(data, 'type')
    if kind is None:
        labels = _string_list(data.get('labels'))
        kind = labels[0] if labels else None
    if kind is None:
        raise KnowledgeServiceError('graph node is missing type')
    label = _first_optional_string(item, 'text', 'title')
    if label is None:
        label = _first_optional_string(data, 'name', 'title')
    # A node ID is the only stable fallback when the upstream has no display
    # label; it is not parsed or otherwise treated as a structured ID.
    label = label or node_id
    properties = {
        _property_key(key): _safe_property(value)
        for key, value in data.items()
        if key not in {'type', 'color', 'borderColor'}
    }
    return _contract_model(lambda: GraphNode(
        id=node_id,
        kind=kind,
        label=label,
        properties=properties,
        provenance=_provenance(node_id, retrieved_at),
    ))


def _graph_edge(
    item: dict[str, Any], *, retrieved_at: datetime | None = None
) -> GraphEdge:
    if not isinstance(item, dict):
        raise KnowledgeServiceError('graph edge must be an object')
    source_id = _required_string(item, 'from')
    target_id = _required_string(item, 'to')
    data = item.get('data')
    if data is not None and not isinstance(data, dict):
        raise KnowledgeServiceError('graph edge data must be an object')
    data = data or {}
    relation = _first_optional_string(data, 'type') or _optional_string(item.get('text'))
    if relation is None:
        raise KnowledgeServiceError('graph edge is missing relation')
    return _contract_model(lambda: GraphEdge(
        source_id=source_id,
        target_id=target_id,
        relation=relation,
        description=_first_optional_string(data, 'description')
        or _optional_string(item.get('description')),
        weight=_optional_number(data.get('weight')),
        provenance=_provenance(None, retrieved_at),
    ))


def map_graph(
    item: dict[str, Any], *, retrieved_at: datetime | None = None
) -> PaperGraph:
    if not isinstance(item, dict):
        raise KnowledgeServiceError('graph response must be an object')
    root_id = _required_string(item, 'rootId')
    nodes = item.get('nodes')
    lines = item.get('lines')
    if not isinstance(nodes, list) or not isinstance(lines, list):
        raise KnowledgeServiceError('graph nodes/lines must be lists')
    mapped_nodes = [_graph_node(node, retrieved_at=retrieved_at) for node in nodes]
    mapped_edges = [_graph_edge(line, retrieved_at=retrieved_at) for line in lines]
    return _contract_model(lambda: PaperGraph(
        root_id=root_id,
        nodes=mapped_nodes,
        edges=mapped_edges,
        provenance=_provenance(root_id, retrieved_at),
    ))


class KnowledgeAdapter:
    """Translate the three upstream calls into the ShenZhi domain contract."""

    def __init__(self, client: Any | None = None):
        self.client = client or KnowledgeBaseClient()

    async def search(self, request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
        body = await self.client.search(_upstream_search_payload(request))
        results = body.get('results') if isinstance(body, dict) else None
        if not isinstance(results, list):
            raise KnowledgeServiceError('search response results must be a list')
        retrieved_at = datetime.now(timezone.utc)
        mapped = [map_search_result(item, retrieved_at=retrieved_at) for item in results]
        return KnowledgeSearchResponse(results=mapped)

    async def paper(self, paper_id: str) -> PaperDetail:
        body = await self.client.paper(paper_id)
        detail = map_paper_detail(body, retrieved_at=datetime.now(timezone.utc))
        if detail.id != paper_id:
            raise KnowledgeServiceError('detail ID does not match requested paper')
        return detail

    async def graph(self, paper_id: str, *, depth: int = 1) -> PaperGraph:
        body = await self.client.graph(paper_id, depth)
        graph = map_graph(body, retrieved_at=datetime.now(timezone.utc))
        if graph.root_id != paper_id:
            raise KnowledgeServiceError('graph rootId does not match requested paper')
        return graph
