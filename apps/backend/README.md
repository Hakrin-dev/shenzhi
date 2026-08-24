# 深知后端 · FastAPI

AI 检索 / 会话 / 生成服务。浏览器 **不直连** 本服务；由 Next.js 微后端同源 `/api/v1` 转发，并带上 `X-ShenZhi-User-Id`。

本地：

```bash
cd apps/backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Web 侧设置（仅服务端，不要 `NEXT_PUBLIC_`）：

```
BUSINESS_BACKEND_URL=http://127.0.0.1:8000
```

当前 `app/main.py` 提供会话契约、**论文检索代理**（`POST /api/v1/search/explore` → 外部 `RETRIEVAL_API_URL`）与 SSE 占位回复（检索结果经 `refs` 事件返回）。真实大模型生成待 B 分支合入。

检索环境变量见 `.env.example`：

```
RETRIEVAL_API_URL=http://47.110.47.12
```
