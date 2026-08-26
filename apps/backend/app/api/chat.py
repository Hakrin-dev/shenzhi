import time
from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from app.core.errors import BusinessError
from app.core.identity import request_owner
from app.core.responses import ok
from app.schemas.chat import CreateSessionBody, FollowupBody, UpdateSessionBody
from app.services.chat import prepare_message, stop_message, stream_events
from app.services.sessions import repository

router = APIRouter(prefix='/api/v1/search', tags=['chat'])


@router.get('/sessions')
async def list_sessions(owner: str = Depends(request_owner)):
    return ok({'sessions': repository.list(owner), 'ephemeral': True})


@router.post('/sessions')
async def create_session(body: CreateSessionBody, owner: str = Depends(request_owner)):
    message = prepare_message(body, owner)
    return ok({'session_id': message.session_id, 'message_id': message.id})


@router.get('/sessions/{session_id}')
async def get_session(session_id: str, owner: str = Depends(request_owner)):
    return ok(repository.get(session_id, owner).public(detail=True))


@router.patch('/sessions/{session_id}')
async def update_session(session_id: str, body: UpdateSessionBody, owner: str = Depends(request_owner)):
    session = repository.get(session_id, owner)
    if body.title is not None:
        if not body.title.strip():
            raise BusinessError(20001, '会话名称不能为空')
        session.title = body.title.strip()
    if body.favorite is not None:
        session.favorite = body.favorite
    session.updated_at = time.time()
    return ok(session.public())


@router.delete('/sessions/{session_id}')
async def delete_session(session_id: str, owner: str = Depends(request_owner)):
    session = repository.get(session_id, owner)
    for message in session.messages:
        await stop_message(message)
    repository.delete(session_id, owner)
    return ok({'ok': True})


@router.post('/sessions/{session_id}/messages')
async def followup(session_id: str, body: FollowupBody, owner: str = Depends(request_owner)):
    message = prepare_message(body, owner, repository.get(session_id, owner))
    return ok({'session_id': session_id, 'message_id': message.id})


@router.get('/messages/{message_id}/stream')
async def stream(message_id: str, owner: str = Depends(request_owner),
                 last_event_id: str | None = Header(default=None)):
    message = repository.message(message_id, owner)
    try:
        cursor = int(last_event_id or '0')
    except ValueError:
        raise BusinessError(20001, '无效的 SSE 游标') from None
    if cursor < 0 or cursor > len(message.events):
        raise BusinessError(20001, 'SSE 游标超出范围')
    return StreamingResponse(stream_events(message, cursor), media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no'})


@router.post('/messages/{message_id}/stop')
async def stop(message_id: str, owner: str = Depends(request_owner)):
    await stop_message(repository.message(message_id, owner))
    return ok({'ok': True})


@router.post('/messages/{message_id}/resume')
async def resume(message_id: str, owner: str = Depends(request_owner)):
    message = repository.message(message_id, owner)
    session = repository.get(message.session_id, owner)
    if session.messages[-1] is not message or message.status not in ('stopped', 'failed'):
        raise BusinessError(20009, '仅支持继续最近一条已停止或失败的回答', 409)
    await stop_message(message)
    cursor = str(len(message.events))
    message.status, message.error, message.task = 'streaming', None, None
    return ok({'session_id': session.id, 'message_id': message.id, 'last_event_id': cursor})
