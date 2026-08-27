# ShenZhi FastAPI

Chat、论文检索、模型流、联网搜索及附件解析。浏览器只访问 Next.js 的 `/api/v1` BFF。

```bash
cd apps/backend
uv sync
cp .env.example .env

# Configure provider/search keys before starting.
# Missing keys produce explicit errors, never mock answers.
uv run uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000

# Validate backend code and tests.
uv run python -m compileall app
uv run python -m unittest discover -s tests -v
```

Web 设置：

```text
BUSINESS_BACKEND_URL=http://127.0.0.1:8000
```

两端配置相同 `BACKEND_BFF_SECRET`；后端只允许私网/BFF 访问，不能直接暴露公网。

未配置 Secret 时默认拒绝；仅 loopback 本地开发可在两端显式设置：

```text
BACKEND_ALLOW_INSECURE_LOCAL_BFF=true
```

当前仅支持 **单进程 / 单 worker**，Session 与解析后的附件为临时内存数据，重启清空。

Python 环境与依赖统一使用 [uv](https://docs.astral.sh/uv/) 管理。新增依赖使用：

```bash
uv add <package>
```

新增开发依赖使用：

```bash
uv add --dev <package>
```

维护说明：[Chat 架构、协议与配置](../../docs/chat/README.md)。
