"""Bounded process-local repository. No ORM or durable Auth/user binding.

Run ONE worker until this is replaced by a shared PostgreSQL repository.
All lookup methods check owner, including uploads and SSE messages.
"""
import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any
from app.core.errors import BusinessError


@dataclass
class Message:
    id: str
    session_id: str
    question: str
    settings: dict[str, Any]
    attachment_context: str = ''
    warnings: list[str] = field(default_factory=list)
    content: str = ''
    reasoning: str = ''
    status: str = 'streaming'
    references: list[dict] = field(default_factory=list)
    followups: list[str] = field(default_factory=list)
    duration_ms: int = 0
    error: str | None = None
    events: list[tuple[str, dict]] = field(default_factory=list)
    task: asyncio.Task | None = None
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    subscribers: int = 0

    def emit(self, event: str, data: dict) -> None:
        self.events.append((event, data))
        self.changed.set()

    def public(self) -> dict:
        return {"last_event_id": str(len(self.events)), **{k: getattr(self, k) for k in (
            'id', 'question', 'content', 'reasoning', 'status', 'references',
            'followups', 'duration_ms', 'error', 'warnings',
        )}}


@dataclass
class Session:
    id: str
    owner: str
    title: str
    settings: dict[str, Any]
    favorite: bool = False
    updated_at: float = field(default_factory=time.time)
    messages: list[Message] = field(default_factory=list)

    def public(self, detail: bool = False) -> dict:
        data = {'id': self.id, 'title': self.title, 'favorite': self.favorite,
                'updated_at': self.updated_at, **self.settings}
        if detail:
            data['messages'] = [m.public() for m in self.messages]
        return data


class MemorySessionRepository:
    def __init__(self, max_sessions: int = 500, ttl: float = 86400):
        self.sessions: dict[str, Session] = {}
        self.messages: dict[str, Message] = {}
        self.uploads: dict[str, dict] = {}
        self.max_sessions = max_sessions
        self.ttl = ttl

    def prune(self) -> None:
        cutoff = time.time() - self.ttl
        for session in list(self.sessions.values()):
            if session.updated_at < cutoff and not any(m.task and not m.task.done() for m in session.messages):
                self.delete(session.id, session.owner)
        self.uploads = {key: value for key, value in self.uploads.items() if value['created_at'] > cutoff}

    def create(self, owner: str, question: str, settings: dict) -> Session:
        self.prune()
        if len(self.sessions) >= self.max_sessions:
            raise BusinessError(20009, '临时会话容量已满，请删除旧会话', 429)
        session = Session(str(uuid.uuid4()), owner, question[:50], settings)
        self.sessions[session.id] = session
        return session

    def get(self, session_id: str, owner: str) -> Session:
        session = self.sessions.get(session_id)
        if not session or session.owner != owner:
            raise BusinessError(20004, '会话不存在或已过期', 404)
        return session

    def session_for_message(self, message: Message) -> Session:
        session = self.sessions.get(message.session_id)
        if not session or not any(item is message for item in session.messages):
            raise BusinessError(20004, '会话不存在或已过期', 404)
        return session

    def message(self, message_id: str, owner: str) -> Message:
        message = self.messages.get(message_id)
        if not message:
            raise BusinessError(20004, '消息不存在或已过期', 404)
        self.get(message.session_id, owner)
        return message

    def add_message(self, session: Session, question: str, settings: dict,
                    context: str = '', warnings: list[str] | None = None) -> Message:
        if any(m.status == 'streaming' for m in session.messages):
            raise BusinessError(20009, '请先停止当前生成', 409)
        if len(session.messages) >= 100:
            raise BusinessError(20009, '单个临时会话最多 100 轮，请新建会话', 429)
        message = Message(str(uuid.uuid4()), session.id, question, dict(settings), context, warnings or [])
        session.messages.append(message)
        session.settings = dict(settings)
        session.updated_at = time.time()
        self.messages[message.id] = message
        return message

    def list(self, owner: str) -> list[dict]:
        self.prune()
        return [s.public() for s in sorted(self.sessions.values(),
                key=lambda s: (s.favorite, s.updated_at), reverse=True) if s.owner == owner]

    def update(self, session_id: str, owner: str, *, title: str | None = None,
               favorite: bool | None = None) -> Session:
        session = self.get(session_id, owner)
        if title is not None:
            if not title.strip():
                raise BusinessError(20001, '会话名称不能为空')
            session.title = title.strip()
        if favorite is not None:
            session.favorite = favorite
        session.updated_at = time.time()
        return session

    def touch(self, session_id: str) -> None:
        session = self.sessions.get(session_id)
        if session:
            session.updated_at = time.time()

    def clear(self) -> None:
        self.sessions.clear()
        self.messages.clear()
        self.uploads.clear()

    def delete(self, session_id: str, owner: str) -> None:
        session = self.get(session_id, owner)
        for message in session.messages:
            if message.task and not message.task.done():
                message.task.cancel()
            self.messages.pop(message.id, None)
        del self.sessions[session_id]

    def save_upload(self, owner: str, filename: str, parsed: dict) -> dict:
        self.prune()
        if len(self.uploads) >= 500:
            raise BusinessError(20009, '临时附件容量已满，请稍后重试', 429)
        file_id = str(uuid.uuid4())
        self.uploads[file_id] = {**parsed, 'file_id': file_id, 'filename': filename,
                                'owner': owner, 'created_at': time.time(), 'parse_status': 'ok'}
        return self.upload(file_id, owner)

    def upload(self, file_id: str, owner: str) -> dict:
        item = self.uploads.get(file_id)
        if not item or item['owner'] != owner or item['created_at'] < time.time() - self.ttl:
            raise BusinessError(20004, '附件不存在或已过期，请重新上传', 404)
        return item

    async def close(self) -> None:
        tasks = [m.task for m in self.messages.values() if m.task and not m.task.done()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


repository = MemorySessionRepository()
