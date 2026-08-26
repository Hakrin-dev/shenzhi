"""Identity supplied by the existing Better Auth BFF, never another login."""
import os
import secrets
from uuid import UUID
from fastapi import Request
from app.core.errors import BusinessError


def request_owner(request: Request) -> str:
    secret = os.getenv('BACKEND_BFF_SECRET', '')
    if secret and not secrets.compare_digest(request.headers.get('x-shenzhi-bff-secret', ''), secret):
        raise BusinessError(10001, '无效的后端调用凭据', 401)
    # Without a secret this API MUST be on a private/loopback network.
    user_id = request.headers.get('x-shenzhi-user-id')
    if user_id:
        return f'user:{user_id}'
    anonymous_id = request.headers.get('x-shenzhi-anonymous-id', '')
    try:
        return f'anon:{UUID(anonymous_id)}'
    except ValueError:
        raise BusinessError(10001, '请通过 Web 入口访问会话', 401) from None
