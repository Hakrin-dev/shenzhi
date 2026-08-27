"""Tavily -> SearXNG fallback; errors are warnings, never fabricated sources."""
import os
import re
from urllib.parse import urlparse
from datetime import datetime
from email.utils import parsedate_to_datetime
import httpx

NEWS_QUERY = re.compile(r'最新|今天|今日|本周|本月|近期|最近|新闻|快讯|热点|突破|发布|上线|召开|举行|现在|当前|latest|news|today|recent|now|20\d{2}', re.I)


def normalize_date(raw):
    if not isinstance(raw, str):
        return None
    for parser in (datetime.fromisoformat, parsedate_to_datetime):
        try:
            return parser(raw).date().isoformat()
        except (ValueError, TypeError):
            pass
    return raw[:100]


def normalize_results(body: dict, engine: str, limit: int) -> list[dict]:
    results = body.get('results')
    if not isinstance(results, list):
        return []
    items = []
    seen = set()
    for item in results:
        if not isinstance(item, dict):
            continue
        url = str(item.get('url') or '')
        if urlparse(url).scheme not in ('http', 'https') or url in seen:
            continue
        seen.add(url)
        items.append({'title': str(item.get('title') or '未命名结果')[:500], 'url': url,
                      'snippet': str(item.get('content') or '')[:3000],
                      'engine': str(item.get('engine') or engine),
                      'published_date': normalize_date(item.get('published_date'))})
        if len(items) >= limit:
            break
    return items


async def web_search(query: str, max_results: int = 6, *, transport=None) -> tuple[list[dict], list[str]]:
    limit = min(max(max_results, 1), 8)
    warnings = []
    async with httpx.AsyncClient(timeout=10, transport=transport) as client:
        key = os.getenv('TAVILY_API_KEY', '')
        if key:
            try:
                news = bool(NEWS_QUERY.search(query))
                response = await client.post('https://api.tavily.com/search', json={
                    'api_key': key, 'query': query, 'max_results': limit,
                    'search_depth': 'advanced', 'include_answer': False,
                    'include_raw_content': False, 'include_images': False,
                    'topic': 'news' if news else 'general',
                    **({'time_range': 'week'} if news else {}),
                })
                response.raise_for_status()
                items = normalize_results(response.json(), 'tavily', limit)
                if items:
                    return items, warnings
                warnings.append('Tavily 未找到结果，尝试备用搜索')
            except (httpx.HTTPError, ValueError, AttributeError):
                warnings.append('Tavily 暂不可用，尝试备用搜索')
        base = os.getenv('SEARXNG_BASE_URL', '').rstrip('/')
        if base:
            try:
                response = await client.get(f'{base}/search', params={'q': query, 'format': 'json'},
                                            headers={'Accept': 'application/json'})
                response.raise_for_status()
                items = normalize_results(response.json(), 'searxng', limit)
                if items:
                    return items, warnings
            except (httpx.HTTPError, ValueError, AttributeError):
                warnings.append('SearXNG 暂不可用')
    warnings.append('联网搜索未获得结果；回答未使用互联网实时资料')
    return [], warnings
