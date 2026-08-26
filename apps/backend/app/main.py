from fastapi import FastAPI
from app.api.search import router

app = FastAPI(title="ShenZhi AI API", version="0.1.0")
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
