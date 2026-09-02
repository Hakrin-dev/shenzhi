"""知识底座数据 → 深知业务数据 的适配层。

负责把科研组 API 返回的数据（integration/knowledge/schemas.py，与使用手册对齐）
转换成深知对外稳定暴露的 camelCase 业务格式，后续真实联调时科研侧字段变化
只需要在本文件内收敛，不影响 API 层与前端契约。

真实接口 → 业务格式的映射要点（对照《论文检索与知识图谱 API 使用手册》）：
- 检索：上游 conference → 业务 venue；state / query_parse / query_rewrite 忽略
- 图谱：上游 lines(from/to/text/data) → 业务 edges(sourceId/targetId/relation)
       上游节点 text/data.type → 业务 label/kind，data 其余字段进 properties

转换约定：
- id 一律按 opaque string 原样透传，禁止解析内部格式
- year / citation_count 等为 None 时保持 None，不补 0
"""
from __future__ import annotations

from typing import Any

from .schemas import (
    KnowledgeGraphResponse,
    KnowledgePaperDetail,
    KnowledgeSearchHit,
    KnowledgeSearchResponse,
)

__all__ = [
    "adapt_search_response",
    "adapt_paper_detail",
    "adapt_graph",
]


def adapt_search_response(response: KnowledgeSearchResponse) -> dict[str, Any]:
    """搜索响应 → 业务格式 {results: [...]}。"""
    return {"results": [adapt_search_hit(hit) for hit in response.results]}


def adapt_search_hit(hit: KnowledgeSearchHit) -> dict[str, Any]:
    """检索结果：上游 conference → 业务 venue。"""
    return {
        "id": hit.paper_id,
        "title": hit.title,
        "abstract": hit.abstract,
        "authors": list(hit.authors or []),
        "year": hit.year,
        "venue": hit.conference,
        "keywords": list(hit.keywords or []),
        "subjects": list(hit.subjects or []),
        "score": hit.score,
        "rank": hit.rank,
        "provenance": {"index": hit.paper_id},
    }


def adapt_paper_detail(detail: KnowledgePaperDetail) -> dict[str, Any]:
    """论文详情：上游 venue / doi / pdf_url 直接透传。

    真实详情接口（手册）未返回 keywords / subjects / 引用数时，业务侧给空值；
    citation_count / reference_count 为 None 表示上游未提供（不等同于 0）。
    """
    return {
        "id": detail.paper_id,
        "title": detail.title,
        "abstract": detail.abstract,
        "authors": list(detail.authors or []),
        "year": detail.year,
        "venue": detail.venue,
        "doi": detail.doi,
        "pdfUrl": detail.pdf_url,
        "keywords": [],
        "subjects": [],
        "citationCount": detail.citation_count,
        "referenceCount": detail.reference_count,
        "provenance": {"index": detail.paper_id},
    }


def adapt_graph(graph: KnowledgeGraphResponse) -> dict[str, Any]:
    """图谱响应 → 业务格式 {rootId, nodes, edges}。

    真实接口为 relation-graph 风格：节点 text/data.type、边 lines(from/to/text)。
    未知类型不抛错，kind 缺省为 UNKNOWN，由前端做默认展示。
    """
    return {
        "rootId": graph.root_id,
        "nodes": [
            {
                "id": node.id,
                "kind": str((node.data or {}).get("type") or "UNKNOWN"),
                "label": node.text or node.id,
                "properties": {
                    key: value
                    for key, value in (node.data or {}).items()
                    if key != "type"
                },
                "provenance": {"index": node.id},
            }
            for node in graph.nodes
        ],
        "edges": [
            {
                "sourceId": line.from_,
                "targetId": line.to,
                "relation": str(
                    line.text or (line.data or {}).get("type") or "UNKNOWN"
                ),
                "description": (line.data or {}).get("description"),
                "weight": (line.data or {}).get("weight"),
                "provenance": {"index": f"{line.from_}→{line.to}"},
            }
            for line in graph.lines
        ],
    }
