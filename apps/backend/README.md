# ShenZhi FastAPI

Chat、论文检索、模型流、联网搜索及附件解析。浏览器只访问 Next.js 的 `/api/v1` BFF。

```bash
cd apps/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure provider/search keys before starting. Missing keys produce explicit errors, never mock answers.
uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000
python -m compileall app
python -m unittest discover -s tests -v
```

Web 设置 `BUSINESS_BACKEND_URL=http://127.0.0.1:8000`。
两端配置相同 `BACKEND_BFF_SECRET`；后端只允许私网/BFF访问，不能直接暴露公网。未配置 Secret 时默认拒绝；仅 loopback 本地开发可在两端显式设置 `BACKEND_ALLOW_INSECURE_LOCAL_BFF=true`。
当前仅支持 **单进程 / 单 worker**，Session 与解析后的附件为临时内存数据，重启清空。

维护说明：[Chat 架构、协议与配置](../../docs/chat/README.md)。
