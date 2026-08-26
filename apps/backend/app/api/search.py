from fastapi import APIRouter
from app.core.config import MAX_FILES, UPLOAD_ACCEPT, model_config
from app.core.responses import ok, fail
from app.schemas.chat import ExploreBody
from app.services.retrieval import map_hit_to_feed_paper, retrieval_search

router = APIRouter(prefix='/api/v1/search', tags=['search'])


@router.get('/config')
def search_config():
    config = model_config()
    return ok({'models': [{'value': model, 'label': model, 'provider': config.provider,
                          'enabled': bool(config.key),
                          **({} if config.key else {'reason': 'provider_not_configured'})}
                         for model in config.models],
               'default_model': config.model,
               'modes': ['fast', 'deep', 'idea', 'doubt'],
               'quota': {'used': 0, 'limit': 0, 'deep_used': 0, 'deep_limit': 0},
               'quota_enforced': False,
               'upload': {'max_size_mb': 20, 'max_files': MAX_FILES, 'accept': UPLOAD_ACCEPT}})


@router.post('/explore')
async def search_explore(body: ExploreBody):
    query = body.query.strip()
    if not query:
        return fail(20001, '请输入检索关键词')
    hits = await retrieval_search(query, top_k=body.top_k, mode=body.mode)
    papers = [map_hit_to_feed_paper(hit, i) for i, hit in enumerate(hits)]
    return ok({'papers': papers, 'scholars': [], 'source': 'retrieval' if papers else 'retrieval_empty',
               'total': len(papers)})
