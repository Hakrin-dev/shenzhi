---
name: shenzhi-ui
description: >-
  Applies ShenZhi production tokens and A-part search/ask overlay. Use when
  editing homepage, composer, /search, /agents/ask, paper cards, colors, fonts.
---

# ShenZhi UI

Baseline is production [http://47.238.241.77/](http://47.238.241.77/) (`bb4ec5d`). Keep `/agents` and `/agents/deep-search` unchanged. Visuals use `app/globals.css` tokens only.

## A overlay

Home composer toolbar: plain + and paperclip (no circle border); model pill only has rounded border. Pill opens panel: mode fast/deep toggle, style submenu expands right, model list expands down covering panel. Alt+Enter shows search inline below on home. Logos on models. Quota compact ring.

- Enter = current mode. Alt+Enter = search. Shift+Enter = newline. IME Enter does not submit.
- 搜索 → `/search?q=`
- 问 AI → `/agents/ask?q=&mode=&model=&web_search=` then `POST /api/v1/search/sessions` `{type:"chat", question, mode, model, web_search, attachments}` and SSE `GET /api/v1/search/messages/{id}/stream`. Do not send to `/agents`.
- Set `BUSINESS_BACKEND_URL` (server-only, e.g. `http://127.0.0.1:8000`) so Next can proxy `/api/v1` to FastAPI. Never `NEXT_PUBLIC_`. Mock search still in `lib/data/*.ts`.

## Tokens

Primary `#174A7E` / dark `#123A63`. Page `#F6F9FC`. Font PingFang SC / Microsoft YaHei. Cards `rounded-2xl bg-card shadow-card`. Composer `rounded-2xl bg-card p-3 shadow-pop`.

Brand tokens in `apps/web/styles/globals.css`:

- 深知蓝 primary `#174A7E` — logo, main buttons, nav highlights
- 深色 primary dark `#123A63` — button hover, dark sidebar (night)
- 浅底 primary soft `#E8F1F8` — cards, citations, selected states, sidebar (day)
- 页面 background `#F6F9FC`
- 正文 ink `#17212B`
- 智能体强调 agent `#0F766E` — 问 AI mode toggle, send button on home (~10% accent)
