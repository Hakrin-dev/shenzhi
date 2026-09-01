from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from app.api import chat, search, uploads
from app.core.errors import BusinessError
from app.core.responses import fail
from app.services.sessions import repository


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await repository.recover()
    yield
    await repository.close()


app = FastAPI(title='ShenZhi AI API', version='1.0.0', lifespan=lifespan)
for router in (chat.router, search.router, uploads.router):
    app.include_router(router)


@app.exception_handler(BusinessError)
async def business_error(_request: Request, error: BusinessError):
    return fail(error.code, error.message, error.status)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _error: RequestValidationError):
    return fail(20001, '请求参数不合法，请检查问题长度、模型和附件数量', 422)


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
