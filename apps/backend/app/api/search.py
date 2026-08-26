from __future__ import annotations
import json
import time
import uuid
from fastapi import APIRouter, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from app.schemas.chat import CreateSessionBody, FollowupBody, ExploreBody
from app.core.responses import ok, fail
from app.services.sessions import _sessions, _messages, actor_id
from app.services.retrieval import map_hit_to_feed_paper, map_hit_to_reference, retrieval_search

router = APIRouter()

@router.get("/api/v1/search/config")
def search_config() -> JSONResponse:
    return ok(
        {
            "models": [
                {
                    "value": "deepseek-chat",
                    "label": "DeepSeek V3",
                    "provider": "deepseek",
                    "enabled": True,
                    "description": "平台默认，平衡速度与回答质量",
                },
                {
                    "value": "deepseek-reasoner",
                    "label": "DeepSeek R1",
                    "provider": "deepseek",
                    "enabled": True,
                    "description": "推理模型，适合复杂分析与证明",
                },
                {
                    "value": "gpt-4o",
                    "label": "GPT-4o",
                    "provider": "openai",
                    "enabled": False,
                    "reason": "not_subscribed",
                    "description": "OpenAI 旗舰多模态模型",
                },
                {
                    "value": "gpt-4o-mini",
                    "label": "GPT-4o mini",
                    "provider": "openai",
                    "enabled": False,
                    "reason": "not_subscribed",
                    "description": "OpenAI 轻量快速模型",
                },
                {
                    "value": "claude-3-5-sonnet",
                    "label": "Claude 3.5 Sonnet",
                    "provider": "anthropic",
                    "enabled": False,
                    "reason": "not_subscribed",
                    "description": "Anthropic 长上下文推理",
                },
                {
                    "value": "gemini-2-flash",
                    "label": "Gemini 2.0 Flash",
                    "provider": "google",
                    "enabled": False,
                    "reason": "not_subscribed",
                    "description": "Google 低延迟模型",
                },
                {
                    "value": "glm-4-plus",
                    "label": "GLM-4 Plus",
                    "provider": "zhipu",
                    "enabled": False,
                    "reason": "not_subscribed",
                    "description": "智谱 GLM，中文与代码表现好",
                },
            ],
            "modes": ["fast", "deep", "idea", "doubt"],
            "quota": {
                "used": 0,
                "limit": 20,
                "deep_used": 0,
                "deep_limit": 5,
            },
            "upload": {
                "max_size_mb": 20,
                "max_files": 5,
                "accept": [".pdf", ".docx", ".md", ".txt"],
            },
        }
    )

@router.post("/api/v1/search/explore")
async def search_explore(body: ExploreBody) -> JSONResponse:
    query = body.query.strip()
    if not query:
        return fail(20001, "请输入检索关键词")

    hits = await retrieval_search(query, top_k=body.top_k, mode=body.mode)
    papers = [map_hit_to_feed_paper(hit, i) for i, hit in enumerate(hits)]

    return ok(
        {
            "papers": papers,
            "scholars": [],
            "source": "retrieval" if papers else "retrieval_empty",
            "total": len(papers),
        }
    )

@router.post("/api/v1/search/sessions")
def create_session(
    body: CreateSessionBody,
    request: Request,
    x_shenzhi_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    question = body.question.strip()
    if not question:
        return fail(20001, "请输入 2000 字以内的问题")
    session_id = str(uuid.uuid4())
    message_id = str(uuid.uuid4())
    owner = actor_id(x_shenzhi_user_id, authorization, request)
    _sessions[session_id] = {
        "id": session_id,
        "owner": owner,
        "type": body.type,
        "mode": body.mode,
        "model": body.model,
        "web_search": body.web_search,
    }
    _messages[message_id] = {
        "id": message_id,
        "session_id": session_id,
        "question": question,
        "status": "streaming",
    }
    return ok({"session_id": session_id, "message_id": message_id})

@router.post("/api/v1/search/sessions/{session_id}/messages")
def followup(
    session_id: str,
    body: FollowupBody,
    request: Request,
    x_shenzhi_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    session = _sessions.get(session_id)
    if not session:
        return fail(20004, "会话不存在", 404)
    question = body.question.strip()
    if not question:
        return fail(20001, "请输入 2000 字以内的问题")
    message_id = str(uuid.uuid4())
    _messages[message_id] = {
        "id": message_id,
        "session_id": session_id,
        "question": question,
        "status": "streaming",
        "owner": actor_id(x_shenzhi_user_id, authorization, request),
    }
    if body.mode:
        session["mode"] = body.mode
    if body.model:
        session["model"] = body.model
    if body.web_search is not None:
        session["web_search"] = body.web_search
    return ok({"session_id": session_id, "message_id": message_id})

@router.get("/api/v1/search/messages/{message_id}/stream")
async def stream(message_id: str) -> StreamingResponse:
    message = _messages.get(message_id)
    if not message:
        return fail(20004, "消息不存在", 404)

    question = message["question"]
    session = _sessions.get(message["session_id"], {})
    mode = session.get("mode", "fast")
    started = time.time()

    async def events():
        hits = await retrieval_search(question, top_k=10, mode=mode)
        references = [
            map_hit_to_reference(hit, i + 1) for i, hit in enumerate(hits)
        ]
        read_count = len(references)
        meta = {"read_count": read_count, "phase": "generating"}
        yield f"event: meta\ndata: {json.dumps(meta, ensure_ascii=False)}\n\n"
        if references:
            refs_payload = {"references": references}
            yield f"event: refs\ndata: {json.dumps(refs_payload, ensure_ascii=False)}\n\n"

        if hits:
            lead = references[0]["title"] if references else ""
            text = (
                f"已检索到 {read_count} 篇相关论文（外部检索服务）。"
                f"问题是：{question}\n\n"
                f"与问题最相关的一篇是「{lead}」。"
                " FastAPI 骨架尚未接入真实大模型，以上为检索占位回复；"
                "引用列表已通过 refs 事件返回，可在前端 ReferenceGrid 展示。"
            )
        else:
            text = (
                f"未在外部论文库中检索到与「{question}」足够相关的结果，"
                "建议更换关键词或开启联网搜索。"
                " FastAPI 骨架尚未接入真实大模型。"
            )
        chunk_size = 24
        for i in range(0, len(text), chunk_size):
            piece = text[i : i + chunk_size].replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
            yield f'event: delta\ndata: {{"text": "{piece}"}}\n\n'
        yield 'event: followups\ndata: {"items": ["继续追问这个方向", "换成文献检索视角"]}\n\n'
        duration_ms = int((time.time() - started) * 1000)
        message["status"] = "done"
        yield f'event: done\ndata: {{"duration_ms": {duration_ms}, "status": "done"}}\n\n'

    return StreamingResponse(events(), media_type="text/event-stream")

@router.post("/api/v1/search/messages/{message_id}/stop")
def stop(message_id: str) -> JSONResponse:
    message = _messages.get(message_id)
    if message:
        message["status"] = "stopped"
    return ok({"ok": True})

@router.post("/api/v1/search/messages/{message_id}/resume")
def resume(message_id: str) -> JSONResponse:
    message = _messages.get(message_id)
    if not message:
        return fail(20004, "消息不存在", 404)
    new_id = str(uuid.uuid4())
    _messages[new_id] = {**message, "id": new_id, "status": "streaming"}
    return ok({"session_id": message["session_id"], "message_id": new_id})

@router.post("/api/v1/uploads")
async def upload(file: UploadFile = File(...)) -> JSONResponse:
    file_id = str(uuid.uuid4())
    return ok({"file_id": file_id, "filename": file.filename})

