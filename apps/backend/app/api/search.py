from fastapi import APIRouter, Depends
from app.core.identity import require_bff
from app.core.responses import ok, fail
from app.schemas.search import ExploreBody
from app.services.retrieval import map_hit_to_feed_paper, retrieval_search

router = APIRouter(prefix='/api/v1/search', tags=['search'])


@router.post('/explore')
async def search_explore(body: ExploreBody, _credential: None = Depends(require_bff)):
    query = body.query.strip()
    if not query:
        return fail(20001, '请输入检索关键词')
    hits = await retrieval_search(query, top_k=body.top_k, mode=body.mode)
    papers = [map_hit_to_feed_paper(hit, i) for i, hit in enumerate(hits)]
    return ok({'papers': papers, 'scholars': [], 'source': 'retrieval' if papers else 'retrieval_empty',
               'total': len(papers)})
