import unittest
from unittest.mock import patch
import httpx

from app.main import app
from app.services import knowledge

ANON = {'x-shenzhi-anonymous-id': '00000000-0000-4000-8000-000000000001'}


class KnowledgeApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.env = patch.dict('os.environ', {
            'BACKEND_BFF_SECRET': '',
            'BACKEND_ALLOW_INSECURE_LOCAL_BFF': 'true',
            'KNOWLEDGE_API_URL': '',
        })
        self.env.start()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url='http://test',
            headers=ANON,
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        self.env.stop()

    async def test_search_returns_contract_shape(self):
        response = await self.client.post('/api/v1/knowledge/search', json={
            'query': 'diffusion policy',
            'topK': 5,
            'yearFrom': 2022,
            'yearTo': 2024,
        })
        self.assertEqual(response.status_code, 200, response.text)
        results = response.json()['data']['results']
        self.assertTrue(len(results) > 0)
        first = results[0]
        # 契约字段（camelCase）必须存在
        for key in ('id', 'title', 'abstract', 'authors', 'year', 'venue',
                    'keywords', 'subjects', 'score', 'rank', 'provenance'):
            self.assertIn(key, first)
        self.assertIsInstance(first['id'], str)
        self.assertIsInstance(first['authors'], list)
        self.assertIsInstance(first['keywords'], list)
        # score 不是百分比（mock 返回 0~1 浮点）
        if first['score'] is not None:
            self.assertIsInstance(first['score'], float)
        # year 可能为 null，不允许补 0
        if first['year'] is not None:
            self.assertGreaterEqual(first['year'], 2022)

    async def test_search_filters_apply(self):
        response = await self.client.post('/api/v1/knowledge/search', json={
            'query': 'policy',
            'venue': ['RSS'],
            'yearFrom': 2023,
            'yearTo': 2024,
        })
        results = response.json()['data']['results']
        self.assertTrue(len(results) > 0)
        for item in results:
            self.assertEqual(item['venue'], 'RSS')
            self.assertTrue(item['year'] is None or 2023 <= item['year'] <= 2024)

    async def test_search_empty_query_returns_empty(self):
        response = await self.client.post('/api/v1/knowledge/search', json={'query': '   '})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['data']['results'], [])

    async def test_paper_detail_contract(self):
        response = await self.client.get('/api/v1/knowledge/paper?paperId=p-diffusion-policy')
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()['data']
        for key in ('id', 'title', 'abstract', 'authors', 'year', 'venue',
                    'doi', 'pdfUrl', 'keywords', 'subjects',
                    'citationCount', 'referenceCount', 'provenance'):
            self.assertIn(key, data)
        self.assertEqual(data['id'], 'p-diffusion-policy')
        self.assertIsInstance(data['citationCount'], int)

    async def test_paper_detail_not_found_maps_to_business_error(self):
        response = await self.client.get('/api/v1/knowledge/paper?paperId=unknown-paper')
        self.assertEqual(response.status_code, 404)
        body = response.json()
        self.assertEqual(body['code'], 21002)

    async def test_graph_default_depth_returns_1hop(self):
        response = await self.client.get('/api/v1/knowledge/graph?paperId=p-diffusion-policy')
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()['data']
        self.assertEqual(data['rootId'], 'p-diffusion-policy')
        self.assertIn('nodes', data)
        self.assertIn('edges', data)
        self.assertTrue(len(data['nodes']) > 5)
        self.assertTrue(len(data['edges']) > 10)
        kinds = {node['kind'] for node in data['nodes']}
        self.assertTrue({'Paper', 'Author', 'Topic'} <= kinds)
        # 所有节点 id / kind / label 齐全
        for node in data['nodes']:
            self.assertTrue(node['id'])
            self.assertTrue(node['kind'])
            self.assertTrue(node['label'])
        for edge in data['edges']:
            self.assertTrue(edge['sourceId'])
            self.assertTrue(edge['targetId'])
            self.assertTrue(edge['relation'])

    async def test_graph_works_for_any_paper(self):
        """任意论文都应能生成关系图谱（之前只有根论文有数据）。"""
        for paper_id in ('p-3d-diffusion-policy', 'p-act', 'p-mobile-aloha'):
            with self.subTest(paper_id=paper_id):
                response = await self.client.get(f'/api/v1/knowledge/graph?paperId={paper_id}')
                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()['data']
                self.assertEqual(data['rootId'], paper_id)
                self.assertTrue(len(data['nodes']) >= 4)
                self.assertTrue(len(data['edges']) >= 4)
                kinds = {node['kind'] for node in data['nodes']}
                self.assertIn('Paper', kinds)

    async def test_graph_not_found(self):
        response = await self.client.get('/api/v1/knowledge/graph?paperId=unknown-paper')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['code'], 21002)

    async def test_upstream_unavailable_maps_to_business_error(self):
        from app.integrations.knowledge import MockKnowledgeApiClient
        with patch.object(knowledge, 'get_knowledge_api', return_value=MockKnowledgeApiClient(scenario='upstream_unavailable')):
            response = await self.client.post('/api/v1/knowledge/search', json={'query': 'diffusion'})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()['code'], 21004)

    async def test_adapter_maps_real_api_format_to_business(self):
        """验证集成层与真实 API 使用手册对齐：conference → venue、lines → edges。"""
        from app.integrations.knowledge.adapter import adapt_graph, adapt_search_response
        from app.integrations.knowledge.mock_data import MockKnowledgeApiClient
        from app.integrations.knowledge.schemas import KnowledgeSearchRequest

        client = MockKnowledgeApiClient()

        # 1) 检索：上游返回 conference（真实格式）→ 业务 venue
        response = await client.search(KnowledgeSearchRequest(query='diffusion policy', top_k=5))
        hit = response.results[0]
        self.assertTrue(hasattr(hit, 'conference'))  # 真实接口字段
        self.assertEqual(hit.conference, hit.conference)
        business = adapt_search_response(response)['results'][0]
        self.assertEqual(business['venue'], hit.conference)
        self.assertEqual(business['id'], hit.paper_id)

        # 2) 图谱：上游返回 lines(from/to/text)（真实格式）→ 业务 edges(sourceId/targetId/relation)
        graph = await client.graph('p-diffusion-policy')
        self.assertTrue(graph.lines)  # 真实接口字段为 lines
        first_line = graph.lines[0]
        self.assertTrue(first_line.from_ and first_line.to and first_line.text)
        business_graph = adapt_graph(graph)
        self.assertEqual(business_graph['rootId'], graph.root_id)
        edge = business_graph['edges'][0]
        self.assertEqual(edge['sourceId'], first_line.from_)
        self.assertEqual(edge['targetId'], first_line.to)
        self.assertEqual(edge['relation'], first_line.text)
        # 节点 kind 从 data.type 推导
        kinds = {node['kind'] for node in business_graph['nodes']}
        self.assertIn('Paper', kinds)

        # 3) 健康检查可用
        health = await client.health()
        self.assertEqual(health['status'], 'ok')

    async def test_manual_example_parses_through_schemas_and_adapter(self):
        """《论文检索与知识图谱 API 使用手册》示例 JSON 可直接被 schema + adapter 解析。"""
        from app.integrations.knowledge.adapter import adapt_graph, adapt_paper_detail, adapt_search_response
        from app.integrations.knowledge.schemas import (
            KnowledgeGraphResponse,
            KnowledgePaperDetail,
            KnowledgeSearchResponse,
        )

        # 手册 §2 检索返回示例（含 conference / state / query_parse / query_rewrite）
        search_body = {
            "results": [{
                "paper_id": "paper:17203_aaai:911ff38f19e8",
                "title": "GraphMix: Improved Training of GNNs...",
                "abstract": "We present GraphMix...",
                "conference": "AAAI",
                "year": 2021,
                "authors": [], "keywords": [], "subjects": [],
                "score": 0.022, "rank": 1,
            }],
            "state": {}, "query_parse": {}, "query_rewrite": {},
        }
        business = adapt_search_response(KnowledgeSearchResponse.model_validate(search_body))['results'][0]
        self.assertEqual(business['id'], 'paper:17203_aaai:911ff38f19e8')
        self.assertEqual(business['venue'], 'AAAI')          # conference → venue
        self.assertEqual(business['score'], 0.022)
        self.assertNotIn('state', business)                  # 非稳定字段不进入业务契约

        # 手册 §3 详情返回示例
        detail_body = {
            "paper_id": "paper:17203_aaai:911ff38f19e8", "title": "...", "authors": [],
            "year": 2021, "venue": "AAAI", "abstract": "...", "doi": "...", "pdf_url": "...",
        }
        detail = adapt_paper_detail(KnowledgePaperDetail.model_validate(detail_body))
        self.assertEqual(detail['venue'], 'AAAI')
        self.assertIsNone(detail['citationCount'])           # 上游未提供 → null 而非 0

        # 手册 §4 图谱返回示例（rootId + nodes + lines(from/to/text/data)）
        graph_body = {
            "rootId": "paper:17203_aaai:911ff38f19e8",
            "nodes": [{"id": "n1", "text": "GraphMix...", "data": {"type": "Paper", "year": 2021}}],
            "lines": [{"from": "paper:17203_aaai:911ff38f19e8", "to": "n2", "text": "CITES", "data": {"type": "CITES"}}],
        }
        graph = adapt_graph(KnowledgeGraphResponse.model_validate(graph_body))
        self.assertEqual(graph['rootId'], 'paper:17203_aaai:911ff38f19e8')
        self.assertEqual(graph['nodes'][0]['kind'], 'Paper') # data.type → kind
        self.assertEqual(graph['edges'][0]['sourceId'], 'paper:17203_aaai:911ff38f19e8')
        self.assertEqual(graph['edges'][0]['relation'], 'CITES')

    async def test_timeout_maps_to_business_error(self):
        from app.integrations.knowledge import MockKnowledgeApiClient
        with patch.object(knowledge, 'get_knowledge_api', return_value=MockKnowledgeApiClient(scenario='timeout')):
            response = await self.client.get('/api/v1/knowledge/graph?paperId=p-diffusion-policy')
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json()['code'], 21005)


if __name__ == '__main__':
    unittest.main()
