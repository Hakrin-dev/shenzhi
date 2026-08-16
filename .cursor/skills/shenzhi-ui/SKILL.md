---
name: shenzhi-ui
description: >-
  Applies ShenZhi production tokens and A-part search/ask overlay. Use when
  editing homepage, composer, /search, /agents/ask, paper cards, colors, fonts.
---

# ShenZhi UI

Baseline is production [http://47.238.241.77/](http://47.238.241.77/) (`bb4ec5d`). Keep `/agents` and `/agents/deep-search` unchanged. Visuals use `app/globals.css` tokens only.

## A overlay

Home composer `variant="home"`: 搜索 / 问 AI. Search hides model, plus, attachments, reply style.

- Enter = current mode. Alt+Enter = search. Shift+Enter = newline. IME Enter does not submit.
- 搜索 → `/search?q=`
- 问 AI → `/agents/ask?q=&mode=&model=&web_search=` then `POST /api/v1/search/sessions` `{type:"chat", question, mode, model, web_search, attachments}` and SSE `GET /api/v1/search/messages/{id}/stream`. Do not send to `/agents`.
- Set `API_URL` (or `NEXT_PUBLIC_API_URL`) to the backend origin; Next proxies `/api/v1`. Mock search still in `lib/data/*.ts`.

## Tokens

Primary `#002FA7` / dark `#5B84F1`. Page `#F7F8FC`. Font PingFang SC / Microsoft YaHei. Cards `rounded-2xl bg-card shadow-card`. Composer `rounded-2xl bg-card p-3 shadow-pop`.
