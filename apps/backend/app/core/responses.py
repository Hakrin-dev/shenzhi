from typing import Any
from fastapi.responses import JSONResponse

def ok(data: dict[str, Any]) -> JSONResponse:
    return JSONResponse({"code": 0, "data": data})

def fail(code: int, message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"code": code, "message": message}, status_code=status)

