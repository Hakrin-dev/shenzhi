"""知识底座 Mock 数据源与 MockKnowledgeApiClient。

当前阶段科研组真实 API 未接入，Mock 客户端返回符合 Contract 的示例数据，
供前后端联调页面与交互使用。真实联调时由 get_knowledge_api() 切换 HTTP 实现。

Mock 支持通过 scenario 模拟不同行为：
    success / zero_results / timeout / upstream_unavailable / not_found
"""
from __future__ import annotations

from typing import Any

from .client import KnowledgeApiClient
from .exceptions import (
    KnowledgeBaseNotFoundError,
    KnowledgeBaseTimeoutError,
    KnowledgeBaseUnavailableError,
)
from .schemas import (
    KnowledgeGraphLine,
    KnowledgeGraphNode,
    KnowledgeGraphResponse,
    KnowledgePaperDetail,
    KnowledgeSearchHit,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)

# ---------------------------------------------------------------------------
# 示例论文数据集（Diffusion Policy / 机器人操作方向）
# ---------------------------------------------------------------------------
_PAPERS: list[dict[str, Any]] = [
    {
        "paper_id": "p-diffusion-policy",
        "title": "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion",
        "abstract": "We introduce Diffusion Policy, a new way of learning robotic visuomotor policies. We formulate visuomotor policy learning as a conditional denoising diffusion process, which generates the action sequence conditioned on the visual observations. Diffusion policy is highly expressive in modeling complex and multimodal action distributions, while remaining easy to train and robust to high-dimensional action spaces.",
        "authors": ["Cheng Chi", "Siyuan Feng", "Yilun Du", "Zhenjia Xu", "Eric Cousineau", "Benjamin Burchfiel", "Shuran Song"],
        "year": 2023,
        "venue": "RSS",
        "doi": "10.15607/rss.2023.xix.079",
        "pdf_url": "https://arxiv.org/pdf/2303.04137",
        "keywords": ["Diffusion Policy", "Visuomotor Policy", "Action Chunking"],
        "subjects": ["Robotics", "Imitation Learning"],
        "citation_count": 1200,
        "reference_count": 58,
        "cites": ["p-act", "p-bc-transformer", "p-diffuser", "p-iql", "p-rt-1"],
    },
    {
        "paper_id": "p-act",
        "title": "Learning Precise Pick-and-Place with a Minimalist Dual-Arm Robot",
        "abstract": "We present Action Chunking with Transformers (ACT), a formulation for learning visuomotor policies for precise manipulation tasks. ACT learns a generative model of action sequences with a transformer, achieving precise and robust pick-and-place performance on a low-cost dual-arm robot.",
        "authors": ["Tony Z. Zhao", "Vijay Kumar", "Sergey Levine", "Chelsea Finn"],
        "year": 2023,
        "venue": "ICRA",
        "doi": "10.1109/icra48891.2023.10160523",
        "pdf_url": "https://arxiv.org/pdf/2304.13705",
        "keywords": ["Action Chunking", "Transformers", "Imitation Learning"],
        "subjects": ["Robotics", "Imitation Learning"],
        "citation_count": 860,
        "reference_count": 41,
        "cites": ["p-diffuser", "p-iql", "p-bc-transformer"],
    },
    {
        "paper_id": "p-rt-1",
        "title": "RT-1: Robotics Transformer for Real-World Control at Scale",
        "abstract": "RT-1 is a multi-task transformer that enables a mobile manipulator to execute hundreds of everyday household tasks from natural language and image observations. It is trained on a large-scale dataset collected with a fleet of robots and generalizes to novel instructions and environments.",
        "authors": ["Anthony Brohan", "Noah Brown", "James Carbajal", "Yevgen Chebotar", "Joseph Dabis", "Chelsea Finn"],
        "year": 2023,
        "venue": "RSS",
        "doi": "10.15607/rss.2023.xix.033",
        "pdf_url": "https://arxiv.org/pdf/2212.06817",
        "keywords": ["Robotics Transformer", "Multi-task", "Language"],
        "subjects": ["Robotics", "Vision-Language"],
        "citation_count": 980,
        "reference_count": 62,
        "cites": ["p-act", "p-bc-transformer", "p-diffuser"],
    },
    {
        "paper_id": "p-rt-2",
        "title": "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control",
        "abstract": "We study how vision-language models trained on internet-scale data can be transferred directly to robotic control. RT-2 shows improved generalization and emergent capabilities, enabling robots to reason about novel objects and instructions grounded in web knowledge.",
        "authors": ["Anthony Brohan", "Noah Brown", "James Carbajal", "Yevgen Chebotar", "Xi Chen", "Chelsea Finn"],
        "year": 2023,
        "venue": "arXiv",
        "doi": "10.48550/arXiv.2307.15818",
        "pdf_url": "https://arxiv.org/pdf/2307.15818",
        "keywords": ["Vision-Language-Action", "Co-training", "Emergent Capability"],
        "subjects": ["Robotics", "Vision-Language"],
        "citation_count": 620,
        "reference_count": 45,
        "cites": ["p-rt-1", "p-diffusion-policy", "p-act"],
    },
    {
        "paper_id": "p-bc-transformer",
        "title": "Robust Manipulation with Transformer-Based Behavior Cloning",
        "abstract": "We show that a single transformer-based behavior cloning model can acquire diverse manipulation skills from offline data and exhibit robustness to visual distractors and unseen task configurations in real-world evaluation.",
        "authors": ["Shagun Uppal", "Ananye Agarwal", "Jitendra Malik"],
        "year": 2023,
        "venue": "RSS",
        "doi": "10.15607/rss.2023.xix.015",
        "pdf_url": "https://arxiv.org/pdf/2303.08319",
        "keywords": ["Behavior Cloning", "Transformers", "Robustness"],
        "subjects": ["Robotics", "Imitation Learning"],
        "citation_count": 240,
        "reference_count": 36,
        "cites": ["p-diffuser", "p-iql"],
    },
    {
        "paper_id": "p-3d-diffusion-policy",
        "title": "3D Diffusion Policy: Generalizable Visuomotor Policy Learning via Simple 3D Representations",
        "abstract": "We introduce 3D Diffusion Policy (DP3), which leverages simple 3D visual representations, such as point clouds, with diffusion policies. DP3 achieves strong generalization across diverse manipulation tasks with only a small number of demonstrations.",
        "authors": ["Yanjie Ze", "Gu Zhang", "Kangning Zhang", "Chenyuan Hu", "Muhan Wang", "Huazhe Xu"],
        "year": 2024,
        "venue": "RSS",
        "doi": "10.15607/rss.2024.xix.027",
        "pdf_url": "https://arxiv.org/pdf/2403.03954",
        "keywords": ["3D Representations", "Diffusion Policy", "Generalization"],
        "subjects": ["Robotics", "Imitation Learning"],
        "citation_count": 380,
        "reference_count": 50,
        "cites": ["p-diffusion-policy", "p-vqbet", "p-act"],
    },
    {
        "paper_id": "p-vqbet",
        "title": "VQ-BeT: Behavior Generation with Latent Actions",
        "abstract": "We propose VQ-BeT, a behavior generation method that combines a tokenizer learning latent actions with a transformer for behavior prediction, enabling multimodal action generation for embodied agents.",
        "authors": ["Seungjae Lee", "Yibin Wang", "Haritheja Etukuru", "H. Jin Kim", "Nur Muhammad Mahi Shafiullah", "Lerrel Pinto"],
        "year": 2024,
        "venue": "ICRA",
        "doi": "10.1109/icra57147.2024.10611507",
        "pdf_url": "https://arxiv.org/pdf/2403.17481",
        "keywords": ["Latent Actions", "Behavior Generation", "Tokenizer"],
        "subjects": ["Robotics", "Imitation Learning"],
        "citation_count": 120,
        "reference_count": 38,
        "cites": ["p-diffusion-policy", "p-bc-transformer", "p-diffuser"],
    },
    {
        "paper_id": "p-diffuser",
        "title": "Diffuser: Diffusion Models as Planning",
        "abstract": "We cast planning as a conditional sampling problem using diffusion models. Diffuser generates entire trajectories and enables long-horizon planning that can be repurposed to solve a range of control tasks.",
        "authors": ["Michael Janner", "Yilun Du", "Joshua B. Tenenbaum", "Sergey Levine"],
        "year": 2022,
        "venue": "ICLR",
        "doi": "10.48550/arXiv.2201.09707",
        "pdf_url": "https://arxiv.org/pdf/2201.09707",
        "keywords": ["Diffusion Models", "Planning", "Trajectory Generation"],
        "subjects": ["Reinforcement Learning", "Planning"],
        "citation_count": 950,
        "reference_count": 55,
        "cites": ["p-iql"],
    },
    {
        "paper_id": "p-iql",
        "title": "Offline Reinforcement Learning with Implicit Q-Learning",
        "abstract": "We introduce Implicit Q-Learning (IQL), an offline reinforcement learning algorithm that avoids querying actions outside of the dataset and learns a value function that is robust to distributional shift.",
        "authors": ["Ilya Kostrikov", "Ashvin Nair", "Sergey Levine"],
        "year": 2022,
        "venue": "ICLR",
        "doi": "10.48550/arXiv.2110.06169",
        "pdf_url": "https://arxiv.org/pdf/2110.06169",
        "keywords": ["Offline RL", "Implicit Q-Learning", "Value Function"],
        "subjects": ["Reinforcement Learning"],
        "citation_count": 1100,
        "reference_count": 47,
        "cites": ["p-diffuser"],
    },
    {
        "paper_id": "p-mobile-aloha",
        "title": "Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware",
        "abstract": "We present Mobile ALOHA, a low-cost and whole-body teleoperation system for data collection, and demonstrate that co-training with static ALOHA data enables learning of complex bimanual mobile manipulation skills.",
        "authors": ["Zipeng Fu", "Tony Z. Zhao", "Chelsea Finn"],
        "year": 2024,
        "venue": "RSS",
        "doi": "10.15607/rss.2024.xix.033",
        "pdf_url": "https://arxiv.org/pdf/2401.02117",
        "keywords": ["Bimanual Manipulation", "Teleoperation", "Imitation Learning"],
        "subjects": ["Robotics", "Imitation Learning"],
        "citation_count": 560,
        "reference_count": 39,
        "cites": ["p-diffusion-policy", "p-act", "p-rt-1"],
    },
]

# ---------------------------------------------------------------------------
# 图谱构建（为任意论文动态生成 depth=1 图谱）
# ---------------------------------------------------------------------------
_PAPER_BY_ID: dict[str, dict[str, Any]] = {p["paper_id"]: p for p in _PAPERS}

# 已知作者 → 机构（用于图谱机构节点，未列出的作者不生成机构）
_AUTHOR_INSTITUTIONS: dict[str, str] = {
    "Cheng Chi": "Columbia University",
    "Shuran Song": "Columbia University",
    "Tony Z. Zhao": "Stanford University",
    "Zipeng Fu": "Stanford University",
    "Chelsea Finn": "UC Berkeley",
    "Sergey Levine": "UC Berkeley",
    "Jitendra Malik": "UC Berkeley",
}


def _slugify(text: str) -> str:
    """文本 → 节点 id 用的 slug（小写 + 短横线）。"""
    import re

    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _paper_node(paper: dict[str, Any]) -> dict[str, Any]:
    """论文 → 真实图谱节点（relation-graph 风格：text 为标签、data 含 type 与属性）。"""
    props: dict[str, Any] = {
        "year": paper.get("year"),
        "venue": paper.get("venue"),
        "abstract": paper.get("abstract"),
        "authors": paper.get("authors", []),
        "doi": paper.get("doi"),
        "pdf_url": paper.get("pdf_url"),
        "keywords": paper.get("keywords", []),
        "external": False,
    }
    return {"id": paper["paper_id"], "text": paper["title"], "data": {**props, "type": "Paper"}}


def _make_node(node_id: str, kind: str, label: str, props: dict[str, Any] | None = None) -> dict[str, Any]:
    """非论文节点 → 真实图谱节点。"""
    return {"id": node_id, "text": label, "data": {**(props or {}), "type": kind}}


def _build_graph(paper_id: str) -> KnowledgeGraphResponse:
    """为任意论文生成 depth=1 关系图谱（真实接口 lines 风格）。

    生成内容：root 论文 + 其引用论文（References）+ 引用它的论文（Citations）
    + 作者（Author）+ 机构（Institution）+ 会议（Venue）+ 关键词/学科（Topic）。
    """
    root = _PAPER_BY_ID.get(paper_id)
    if root is None:
        raise KnowledgeBaseNotFoundError(f"未找到论文图谱 {paper_id}")

    nodes: list[KnowledgeGraphNode] = []
    lines: list[KnowledgeGraphLine] = []
    seen: set[str] = set()

    def add_node(node: dict[str, Any]) -> None:
        if node["id"] in seen:
            return
        seen.add(node["id"])
        nodes.append(KnowledgeGraphNode(**node))

    def add_line(source_id: str, target_id: str, relation: str, description: str, weight: float) -> None:
        lines.append(
            KnowledgeGraphLine(
                from_=source_id,
                to=target_id,
                text=relation,
                data={"type": relation, "description": description, "weight": weight},
            )
        )

    add_node(_paper_node(root))

    # References：root 引用的论文（from === rootId）
    for ref_id in root.get("cites", []):
        ref = _PAPER_BY_ID.get(ref_id)
        if ref is None:
            continue
        add_node(_paper_node(ref))
        add_line(root["paper_id"], ref["paper_id"], "CITES", "引用", 0.85)

    # Citations：引用 root 的论文（to === rootId）
    for paper in _PAPERS:
        if paper["paper_id"] == root["paper_id"]:
            continue
        if root["paper_id"] in paper.get("cites", []):
            add_node(_paper_node(paper))
            add_line(paper["paper_id"], root["paper_id"], "CITES", "被引用", 0.75)

    # 作者（AUTHORED_BY）+ 机构（AFFILIATED_WITH）
    for index, author in enumerate(root.get("authors", [])):
        author_id = f"a-{_slugify(author)}"
        add_node(_make_node(author_id, "Author", author))
        add_line(root["paper_id"], author_id, "AUTHORED_BY", "第一作者" if index == 0 else "作者", 1.0)

        institution = _AUTHOR_INSTITUTIONS.get(author)
        if institution:
            institution_id = f"i-{_slugify(institution)}"
            add_node(_make_node(institution_id, "Institution", institution))
            add_line(author_id, institution_id, "AFFILIATED_WITH", "所属机构", 1.0)

    # 会议（PUBLISHED_IN）
    venue = root.get("venue")
    if venue:
        venue_id = f"v-{_slugify(venue)}"
        add_node(_make_node(venue_id, "Venue", venue, {"year": root.get("year")}))
        add_line(root["paper_id"], venue_id, "PUBLISHED_IN", "发表会议", 1.0)

    # 关键词 / 学科 → 主题（HAS_TOPIC）
    keywords = root.get("keywords", [])
    for index, topic in enumerate([*keywords, *root.get("subjects", [])]):
        topic_id = f"t-{_slugify(topic)}"
        add_node(_make_node(topic_id, "Topic", topic))
        weight = 0.85 if index < len(keywords) else 0.7
        add_line(root["paper_id"], topic_id, "HAS_TOPIC", "研究主题", weight)

    return KnowledgeGraphResponse(root_id=root["paper_id"], nodes=nodes, lines=lines)


class MockKnowledgeApiClient(KnowledgeApiClient):
    """Mock 实现：基于本地数据集返回符合 Contract 的数据。

    scenario 用于模拟失败行为（页面错误态演示 / 测试）：
        success        正常返回
        zero_results   搜索返回空结果
        timeout        模拟超时
        upstream_unavailable  模拟上游不可用
        not_found      论文详情 / 图谱返回 404
    """

    def __init__(self, scenario: str = "success") -> None:
        self.scenario = scenario

    async def search(self, request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
        if self.scenario == "timeout":
            raise KnowledgeBaseTimeoutError()
        if self.scenario == "upstream_unavailable":
            raise KnowledgeBaseUnavailableError()

        text = request.query.strip().lower()
        hits: list[KnowledgeSearchHit] = []
        for paper in _PAPERS:
            if not _match_search(paper, text, request):
                continue
            score = _mock_score(paper, text)
            # 上游检索响应字段为 conference（对照使用手册）
            hits.append(
                KnowledgeSearchHit(
                    paper_id=paper["paper_id"],
                    title=paper["title"],
                    abstract=paper.get("abstract"),
                    authors=paper.get("authors", []),
                    year=paper.get("year"),
                    conference=paper.get("venue"),
                    keywords=paper.get("keywords", []),
                    subjects=paper.get("subjects", []),
                    score=score,
                    rank=None,
                )
            )

        hits.sort(key=lambda hit: (hit.score or 0), reverse=True)
        for rank, hit in enumerate(hits, start=1):
            hit.rank = rank

        if self.scenario == "zero_results":
            hits = []
        return KnowledgeSearchResponse(results=hits[: request.top_k], state={})

    async def paper(self, paper_id: str) -> KnowledgePaperDetail:
        if self.scenario == "timeout":
            raise KnowledgeBaseTimeoutError()
        if self.scenario == "upstream_unavailable":
            raise KnowledgeBaseUnavailableError()
        paper = _PAPER_BY_ID.get(paper_id)
        if paper is None or self.scenario == "not_found":
            raise KnowledgeBaseNotFoundError(f"未找到论文 {paper_id}")
        return KnowledgePaperDetail(
            paper_id=paper["paper_id"],
            title=paper["title"],
            abstract=paper.get("abstract"),
            authors=paper.get("authors", []),
            year=paper.get("year"),
            venue=paper.get("venue"),
            doi=paper.get("doi"),
            pdf_url=paper.get("pdf_url"),
            citation_count=paper.get("citation_count"),
            reference_count=paper.get("reference_count"),
        )

    async def graph(self, paper_id: str, depth: int = 1) -> KnowledgeGraphResponse:
        if self.scenario == "timeout":
            raise KnowledgeBaseTimeoutError()
        if self.scenario == "upstream_unavailable":
            raise KnowledgeBaseUnavailableError()
        if self.scenario == "not_found":
            raise KnowledgeBaseNotFoundError(f"未找到论文图谱 {paper_id}")
        return _build_graph(paper_id)

    async def health(self) -> dict[str, Any]:
        if self.scenario == "upstream_unavailable":
            raise KnowledgeBaseUnavailableError()
        if self.scenario == "timeout":
            raise KnowledgeBaseTimeoutError()
        return {"status": "ok", "source": "mock"}


def _match_search(
    paper: dict[str, Any],
    text: str,
    request: KnowledgeSearchRequest,
) -> bool:
    """对单篇论文做 mock 检索匹配（文本 + 筛选条件）。"""
    if text and not _paper_contains(paper, text):
        return False

    year = paper.get("year")
    if request.year_gte is not None and (year is None or year < request.year_gte):
        return False
    if request.year_lte is not None and (year is None or year > request.year_lte):
        return False

    # 上游筛选字段为 conference（对照使用手册）
    venue = paper.get("venue")
    if request.conference and (not venue or venue not in request.conference):
        return False

    authors = [a.lower() for a in paper.get("authors", [])]
    if request.author and not any(
        any(part in author for author in authors)
        for part in (a.lower() for a in request.author)
    ):
        return False

    keywords = [k.lower() for k in paper.get("keywords", [])]
    if request.keyword and not any(k in keywords for k in (x.lower() for x in request.keyword)):
        return False

    subjects = [s.lower() for s in paper.get("subjects", [])]
    if request.subject and not any(s in subjects for s in (x.lower() for x in request.subject)):
        return False

    return True


def _paper_contains(paper: dict[str, Any], text: str) -> bool:
    haystack = " ".join(
        str(part).lower()
        for part in [
            paper.get("title"),
            paper.get("abstract"),
            *paper.get("authors", []),
            *paper.get("keywords", []),
            *paper.get("subjects", []),
        ]
        if part
    )
    return text in haystack


def _mock_score(paper: dict[str, Any], text: str) -> float:
    """根据是否命中标题 / 关键词生成一个粗略的 mock 相关性得分（非百分比）。"""
    base = 0.5
    title = (paper.get("title") or "").lower()
    keywords = " ".join(paper.get("keywords", [])).lower()
    if text and text in title:
        base += 0.35
    if text and text in keywords:
        base += 0.2
    base += ((paper.get("citation_count") or 0) % 100) / 1000
    return round(min(base, 1.0), 4)


__all__ = ["MockKnowledgeApiClient", "_PAPERS", "_PAPER_BY_ID"]
