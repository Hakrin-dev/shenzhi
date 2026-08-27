"""Identity supplied by the existing Better Auth BFF, never another login."""
import os
import secrets
from ipaddress import ip_address
from uuid import UUID
from fastapi import Request
from app.core.errors import BusinessError


def require_bff(request: Request) -> None:
    secret = os.getenv('BACKEND_BFF_SECRET', '')
    if secret:
        if secrets.compare_digest(request.headers.get('x-shenzhi-bff-secret', ''), secret):
            return
        raise BusinessError(10001, '无效的后端调用凭据', 401)

    allow_local = os.getenv('BACKEND_ALLOW_INSECURE_LOCAL_BFF', '').strip().lower() == 'true'
    host = request.client.host if request.client else ''
    try:
        is_loopback = ip_address(host).is_loopback
    except ValueError:
        is_loopback = False
    if not allow_local or not is_loopback:
        raise BusinessError(10001, '后端调用凭据未配置', 503)


def request_owner(request: Request) -> str:
    require_bff(request)
    user_id = request.headers.get('x-shenzhi-user-id')
    if user_id:
        return f'user:{user_id}'
    anonymous_id = request.headers.get('x-shenzhi-anonymous-id', '')
    try:
        return f'anon:{UUID(anonymous_id)}'
    except ValueError:
        raise BusinessError(10001, '请通过 Web 入口访问会话', 401) from None
