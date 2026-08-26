from typing import Any
from fastapi import Request

# Temporary process-local repository; PostgreSQL identity binding is deferred.
_sessions: dict[str, dict[str, Any]] = {}
_messages: dict[str, dict[str, Any]] = {}

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

