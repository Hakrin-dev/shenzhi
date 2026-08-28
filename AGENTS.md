# ShenZhi · Agent 开发规范（仓库级）

正式开发基线：**`dev` 分支**（https://github.com/Hakrin-dev/shenzhi/tree/dev）。

`feat/ai-agent-B` 仅作对照与迁移参考，不再作为正式开发分支。

## 调用链（必须理解）

```text
Next.js Page / Feature
  → Client
  → Next.js BFF（/api/auth、/api/v1、/api/b）
  → FastAPI API（apps/backend）
  → Service / 外部 API
```

浏览器**不直连** FastAPI；登录身份由 Next BFF 注入 `X-ShenZhi-User-Id`。

## Git 流程

```text
dev → feat/* → 开发 → 自测 → 合并回 dev
```

原则上不长期在 `dev` 上直接开发。

## 禁止重复建设

新增功能前先确认项目内是否已有能力。禁止再建：

- 第二套 Auth
- 第二套数据库访问方案
- 第二套 Backend Client
- 重复公共组件
- 与当前架构平行的新目录

跨模块修改（公共组件、Schema、公共 API、他人负责模块）须先同步方案再动手。

## 文档索引

| 文档 | 用途 |
|------|------|
| `apps/web/AGENTS.md` | 前端与 BFF |
| `apps/backend/AGENTS.md` | FastAPI 后端 |
| `docs/engineering/ARCHITECTURE.md` | 架构与模块边界 |
| `docs/auth/ARCHITECTURE.md` | 鉴权边界 |

## 当前阶段重点

1. 统一项目认知与规范（阶段一）
2. 解决 Auth/Chat 融合遗留问题（阶段二）
3. 再进入正常业务开发与 Bug 修复（阶段三）
