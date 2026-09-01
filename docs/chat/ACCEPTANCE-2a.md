# Chat 持久化 2a · 验收用例表

基线：Backend 配置 `CHAT_DATABASE_URL`，单 worker；表已 `alembic upgrade head`。  
判定：Pass / Fail / Skip；Fail 须附现象与复现步骤。

| ID | 前置 | 步骤 | 期望 | 等级 |
| --- | --- | --- | --- | --- |
| E-01 | 本机 PG 可连 | `pg_isready`；`psql` 连 `shenzhi_chat` | 服务就绪；库存在 | P0 |
| E-02 | 已 upgrade | `\dt`；`alembic_version` | 有 `chat_sessions`/`chat_messages`；版本 `001_chat_tables` | P0 |
| C-01 | PG 模式 | `GET /chat/sessions` | `ephemeral=false`；`code=0` | P0 |
| C-02 | 无会话 owner | `POST /chat/sessions` 首问 | 返回 session_id/message_id；DB 有 1 session + 1 message(streaming→终态) | P0 |
| C-03 | C-02 完成 | SSE 跑完；`GET /sessions/{id}` | content/status=done；refs/followups 可空非必失败 | P0 |
| C-04 | 已有会话 | 同 session 续问 + SSE | 第 2 条 message；`model_messages` 含上一轮 | P0 |
| C-05 | 多轮完成 | 停 Backend 进程内缓存（新进程/clear 内存后仍读 PG）或重启后 `GET` 列表与详情 | 历史仍在；标题/内容一致 | P0 |
| C-06 | 有会话 | PATCH 收藏+重命名；重启/重读 | favorite/title 仍在 | P0 |
| C-07 | 有会话 | DELETE；再 GET/stream | 404；库中无该 session | P0 |
| C-08 | owner A 有数据 | owner B 访问 A 的 session/message | 全部 404；B 列表为空 | P0 |
| C-09 | streaming 行 | 调 `recover()` 或模拟重启 | status=failed；content 保留 | P0 |
| C-10 | 已 done | 再 `persist_message` 改 content | DB content 不变（幂等） | P0 |
| C-11 | 未配 CHAT_DATABASE_URL | 跑原 ChatApiTests | 16 项全过；`ephemeral=true` | P0 |
| C-12 | PG 模式 | 单元/契约 `test_persistence` | 契约项全过 | P0 |
| M-01 | 可选 | 匿名→登录改 owner | 会话内容不变仅 owner 变更 | P2（2a 后置） |

验收测试使用 `purge_owner`，**禁止**对共享开发库调用全库 `clear()`，以免清空浏览器联调数据。

## 执行记录

| 批次 | 环境 | 结果汇总 | 备注 |
| --- | --- | --- | --- |
| 2026-09-01 | 本机 PG 16.15（LocalAppData binaries）+ `shenzhi_chat` / Alembic `001_chat_tables` | **E-01～E-02 Pass；C-01～C-10 Pass（10/10）；C-11 Pass（9 Chat API + services 基线）** | 修复：SSE 结束后勿 cancel 已终态的 generate，否则打断 `persist_message`。匿名→登录改归属（M-01）未测（P2） |

### 逐条判定（本批次）

| ID | 结果 |
| --- | --- |
| E-01 | Pass |
| E-02 | Pass |
| C-01 | Pass |
| C-02 / C-03 | Pass |
| C-04 | Pass |
| C-05 | Pass |
| C-06 | Pass |
| C-07 | Pass |
| C-08 | Pass |
| C-09 | Pass |
| C-10 | Pass |
| C-11 | Pass |
| C-12 | Pass（`tests.test_persistence` + 上表） |
| M-01 | Skip（2a 后置） |

### 复跑命令

```powershell
# 启动本机 PG（若未运行）
& "$env:LOCALAPPDATA\shenzhi-postgresql\pgsql\bin\pg_ctl.exe" `
  -D "$env:LOCALAPPDATA\shenzhi-postgresql\data" `
  -l "$env:LOCALAPPDATA\shenzhi-postgresql\logfile.txt" `
  -o "-p 5432" start

cd apps/backend
$env:CHAT_DATABASE_URL = "postgresql://shenzhi:shenzhi_dev@127.0.0.1:5432/shenzhi_chat"
uv run python -m unittest tests.test_acceptance_2a -v

# 内存降级基线（勿设置 CHAT_DATABASE_URL）
Remove-Item Env:CHAT_DATABASE_URL -ErrorAction SilentlyContinue
uv run python -m unittest tests.test_chat_api tests.test_services -v
```

