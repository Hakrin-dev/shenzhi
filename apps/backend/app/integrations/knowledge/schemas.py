"""知识底座科研组接口的输入输出 Schema。

本文件描述「知识底座科研组 API」自身的请求 / 响应格式，
仅供 integrations/knowledge 内部与 Mock / HTTP Client 使用，
不直接暴露给深知业务侧；业务数据转换统一走 adapter.py。

字段命名与《论文检索与知识图谱 API 使用手册》对齐：
- 检索：POST /api/retrieval/search，请求用 conference，响应含 conference / state
- 详情：GET  /api/kg/paper?paperId=...，字段 venue / doi / pdf_url
- 图谱：GET  /api/kg/graph?paperId=...&depth=1，返回 rootId + nodes + lines(from/to/text/data)
  （真实图谱为 relation-graph 风格：节点 data.type 为类型、lines 表达边）

约定：
- id 一律视为 opaque string，禁止解析内部格式
- year / citation_count 等为 null 表示上游未提供，不等同于 0
- state / query_parse / query_rewrite / color / borderColor 等非稳定字段不进入业务契约
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "KnowledgeSearchRequest",
    "KnowledgeSearchHit",
    "KnowledgeSearchResponse",
    "KnowledgePaperDetail",
    "KnowledgeGraphNode",
    "KnowledgeGraphLine",
    "KnowledgeGraphResponse",
]


# ---------------------------------------------------------------------------
# Search（POST /api/retrieval/search）
# ---------------------------------------------------------------------------
class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    top_k: int = Field(default=10, ge=1, le=50)

    year_gte: int | None = Field(default=None, ge=1800, le=2100)
    year_lte: int | None = Field(default=None, ge=1800, le=2100)

    conference: list[str] = Field(default_factory=list)
    author: list[str] = Field(default_factory=list)
    keyword: list[str] = Field(default_factory=list)
    subject: list[str] = Field(default_factory=list)


class KnowledgeSearchHit(BaseModel):
    paper_id: str
    title: str
    abstract: str | None = None
    conference: str | None = None
    year: int | None = None
    authors: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    subjects: list[str] = Field(default_factory=list)
    score: float | None = None
    rank: int | None = None


class KnowledgeSearchResponse(BaseModel):
    results: list[KnowledgeSearchHit] = Field(default_factory=list)
    # 真实接口还会返回 state / query_parse / query_rewrite，均非稳定契约，忽略
    state: Any = None


# ---------------------------------------------------------------------------
# Paper Detail（GET /api/kg/paper?paperId=...）
# ---------------------------------------------------------------------------
class KnowledgePaperDetail(BaseModel):
    paper_id: str
    title: str
    abstract: str | None = None
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    venue: str | None = None

    doi: str | None = None
    pdf_url: str | None = None

    # 非稳定字段：真实接口不一定返回，缺省为 None（不等同于 0）
    citation_count: int | None = None
    reference_count: int | None = None


# ---------------------------------------------------------------------------
# Graph（GET /api/kg/graph?paperId=...&depth=1）
# 真实返回为 relation-graph 风格：rootId + nodes + lines
# ---------------------------------------------------------------------------
class KnowledgeGraphNode(BaseModel):
    """图谱节点（relation-graph 风格：text 为标签、data.type 为类型）。"""

    id: str
    text: str = ""
    data: dict[str, Any] = Field(default_factory=dict)
    # 真实接口可能返回 color / borderColor 等展示字段，此处不建模、不进入业务契约


class KnowledgeGraphLine(BaseModel):
    """图谱边（真实接口的 lines：from 引用 to，text 为关系名）。"""

    from_: str = Field(alias="from")
    to: str
    text: str = ""
    data: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class KnowledgeGraphResponse(BaseModel):
    root_id: str = Field(alias="rootId")
    nodes: list[KnowledgeGraphNode] = Field(default_factory=list)
    lines: list[KnowledgeGraphLine] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)
