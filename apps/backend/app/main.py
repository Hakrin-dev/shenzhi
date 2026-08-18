from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import FastAPI, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(title="ShenZhi AI API", version="0.1.0")


class ChatAttachment(BaseModel):
    kind: str
    file_id: str | None = None
    ref_id: str | None = None
    title: str | None = None


class CreateSessionBody(BaseModel):
    type: str = "chat"
    question: str = Field(min_length=1, max_length=2000)
    mode: str = "fast"
    model: str = "default"
    web_search: bool = False
    attachments: list[ChatAttachment] = Field(default_factory=list)


class FollowupBody(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    mode: str | None = None
    model: str | None = None
    web_search: bool | None = None
    attachments: list[ChatAttachment] | None = None


# 进程内骨架存储；正式实现应换 PostgreSQL。
_sessions: dict[str, dict[str, Any]] = {}
_messages: dict[str, dict[str, Any]] = {}


def ok(data: dict[str, Any]) -> JSONResponse:
    return JSONResponse({"code": 0, "data": data})


def fail(code: int, message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"code": code, "message": message}, status_code=status)


def actor_id(
    x_shenzhi_user_id: str | None,
    authorization: str | None,
    request: Request,
) -> str:
    if x_shenzhi_user_id:
        return f"user:{x_shenzhi_user_id}"
    if authorization:
        return "bearer"
    ip = request.client.host if request.client else "anonymous"
    return f"anon:{ip}"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/search/config")
def search_config() -> JSONResponse:
    return ok(
        {
            "models": [
                {"value": "default", "label": "默认", "enabled": True},
                {
                    "value": "subscription",
                    "label": "订阅",
                    "enabled": False,
                    "reason": "not_subscribed",
                },
                {
                    "value": "byok",
                    "label": "API接入",
                    "enabled": False,
                    "reason": "no_api_key",
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


@app.post("/api/v1/search/sessions")
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


@app.post("/api/v1/search/sessions/{session_id}/messages")
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


@app.get("/api/v1/search/messages/{message_id}/stream")
async def stream(message_id: str) -> StreamingResponse:
    message = _messages.get(message_id)
    if not message:
        return fail(20004, "消息不存在", 404)

    question = message["question"]
    started = time.time()

    async def events():
        yield 'event: meta\ndata: {"read_count": 0, "phase": "generating"}\n\n'
        text = (
            f"这是 FastAPI 骨架回复，尚未接入真实模型。问题是：{question}\n\n"
            "Next.js 微后端已把请求转发到本服务；接上检索与模型后替换此生成逻辑即可。"
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


@app.post("/api/v1/search/messages/{message_id}/stop")
def stop(message_id: str) -> JSONResponse:
    message = _messages.get(message_id)
    if message:
        message["status"] = "stopped"
    return ok({"ok": True})


@app.post("/api/v1/search/messages/{message_id}/resume")
def resume(message_id: str) -> JSONResponse:
    message = _messages.get(message_id)
    if not message:
        return fail(20004, "消息不存在", 404)
    new_id = str(uuid.uuid4())
    _messages[new_id] = {**message, "id": new_id, "status": "streaming"}
    return ok({"session_id": message["session_id"], "message_id": new_id})


@app.post("/api/v1/uploads")
async def upload(file: UploadFile = File(...)) -> JSONResponse:
    file_id = str(uuid.uuid4())
    return ok({"file_id": file_id, "filename": file.filename})
