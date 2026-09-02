"""知识底座 API 路由。

承载知识底座能力的对外接口（经 Next.js BFF 转发到本后端）：
    POST /api/v1/knowledge/search   论文搜索
    GET  /api/v1/knowledge/paper    论文详情
    GET  /api/v1/knowledge/graph    论文关系图谱

业务校验与数据组装在 services/knowledge.py 与 integrations/knowledge。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.identity import require_bff
from app.core.responses import ok
from app.schemas.knowledge import KnowledgeSearchBody
from app.services.knowledge import (
    knowledge_graph,
    knowledge_paper_detail,
    knowledge_search,
)

router = APIRouter(prefix='/api/v1/knowledge', tags=['knowledge'])


@router.post('/search')
async def search_papers(
    body: KnowledgeSearchBody,
    _credential: None = Depends(require_bff),
):
    data = await knowledge_search(
        body.query,
        top_k=body.topK,
        year_from=body.yearFrom,
        year_to=body.yearTo,
        venue=body.venue,
        author=body.author,
        keyword=body.keyword,
        subject=body.subject,
    )
    return ok(data)


@router.get('/paper')
async def paper_detail(
    paperId: str = Query(min_length=1, max_length=200),
    _credential: None = Depends(require_bff),
):
    data = await knowledge_paper_detail(paperId)
    return ok(data)


@router.get('/graph')
async def paper_graph(
    paperId: str = Query(min_length=1, max_length=200),
    depth: int = Query(default=1, ge=1, le=3),
    _credential: None = Depends(require_bff),
):
    data = await knowledge_graph(paperId, depth=depth)
    return ok(data)
