# 深知 ShenZhi · AI 研究助手（B 模块）

> **更新日期**：2026-08-25
>
> 深知是面向人工智能领域学术科研的**专业可信知识智能体服务平台**。本仓库为 B 模块（前端 + 本地直连大模型），提供 AI 研究助手对话、深度研究、联网搜索、知识图谱、论文检索、学者画像、科研项目、投稿指南等完整能力。

---

## 实现的功能

### 核心功能

| 功能模块 | 描述 | 状态 |
|----------|------|------|
| **AI 对话助手** | 支持流式对话，4 种回复风格（快速 / 深度 / 启发 / 批判），实时思考链展示 | ✅ |
| **DeepSeek 模型接入** | 直连 DeepSeek API，支持 deepseek-chat / deepseek-reasoner（R1 推理模型） | ✅ |
| **联网搜索** | 集成 Tavily 搜索引擎，对话中可开启联网搜索获取实时信息，支持降级到 SearXNG | ✅ |
| **附件解析** | 支持 PDF / Markdown / TXT 附件上传与内容解析，融入对话上下文 | ✅ |
| **用户认证** | 注册 / 登录 / 找回密码，基于 NextAuth + bcrypt | ✅ |
| **会话管理** | 多会话历史、消息收藏、分享链接（只读 Token） | ✅ |
| **深度研究** | Deep Research 报告生成与播放，研究工作台、步骤时间线、来源墙 | ✅ |
| **知识图谱** | 图谱可视化、节点卡片、关联论文列表、图谱布局算法 | ✅ |
| **论文检索** | 搜索结果 Feed 流、论文卡片、论文详情页（目录 / 缩略图 / 缩放） | ✅ |
| **学者画像** | 学者列表、详情页、引用图表、研究方向、论文列表、学者网络 | ✅ |
| **科研机构** | 机构浏览、机构卡片 | ✅ |
| **知识仪表盘** | 资助项目、专利、图书馆资源面板 | ✅ |
| **科研项目** | 项目列表、项目详情页（里程碑 / 成员 / 技术栈 / 链接） | ✅ |
| **投稿指南** | 期刊列表、筛选面板、会议倒计时、录用率标签 | ✅ |
| **日/夜模式** | 完整的明暗双主题切换，品牌设计令牌体系 | ✅ |

### 页面清单

| 路由 | 页面 |
|------|------|
| `/` | 首页（搜索入口） |
| `/agents` | AI 研究助手首页 |
| `/agents/ask` | AI 对话页 |
| `/agents/deep-research` | 深度研究页 |
| `/agents/auto-research` | 自动研究页 |
| `/agents/deep-search` | 深度搜索页 |
| `/search` | 搜索结果页 |
| `/papers/[id]` | 论文详情页 |
| `/papers/[id]/graph` | 论文知识图谱页 |
| `/scholars` | 学者列表页 |
| `/scholars/[id]` | 学者详情页 |
| `/knowledge` | 知识仪表盘 |
| `/knowledge/papers` | 论文知识库 |
| `/knowledge/scholars` | 学者知识库 |
| `/knowledge/scholars/graph` | 学者图谱 |
| `/knowledge/institutions` | 科研机构 |
| `/knowledge/funding` | 资助项目 |
| `/knowledge/patents` | 专利库 |
| `/knowledge/graph` | 全局知识图谱 |
| `/knowledge/library` | 图书馆资源 |
| `/projects` | 科研项目列表 |
| `/projects/[id]` | 项目详情页 |
| `/submit` | 投稿指南首页 |
| `/submit/journals` | 期刊列表 |
| `/login` | 登录页 |
| `/register` | 注册页 |
| `/reset-password` | 找回密码页 |
| `/settings` | 设置页 |

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + tw-animate-css + Framer Motion |
| 状态管理 | TanStack Query v5 + Zustand v5 |
| AI 模型 | DeepSeek API（OpenAI 兼容协议） |
| 联网搜索 | Tavily Search API / SearXNG（降级） |
| 数据库 | SQLite + Prisma ORM |
| 认证 | NextAuth v5 + bcryptjs |
| 邮件 | Nodemailer（SMTP，找回密码） |
| Markdown | react-markdown + remark-gfm + remark-math + rehype-katex |
| 包管理 | pnpm 11 |
| 部署 | Docker + GitHub Actions + GHCR + Watchtower |

---

## 快速开始

### 环境要求

- Node.js >= 22
- pnpm >= 11

### 安装与运行

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 生产构建
pnpm build

# 启动生产服务
pnpm start
```

打开 http://localhost:3000 即可访问。

### Windows 一键启动

项目提供了 Windows 批处理脚本，双击即可自动完成环境检查、依赖安装与服务启动：

- `scripts/start-dev.bat` — 仅启动前端开发服务器
- `scripts/start-all.bat` — 同时启动前端 + 后端（需后端项目存在）

---

## API 配置指南

### 1. DeepSeek API 配置

DeepSeek 提供大语言模型能力，是 AI 对话的核心后端。

#### 步骤

1. **注册账号**：访问 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册账号
2. **获取 API Key**：进入「API Key 管理」页面，创建新的 API Key（格式为 `sk-` 开头的字符串）
3. **配置环境变量**：在项目根目录创建 `.env.local` 文件，添加以下内容：

```env
# DeepSeek API 密钥（必填，服务端只读，不会泄露到前端）
DEEPSEEK_API_KEY=sk-你的API密钥

# DeepSeek API 地址（默认即可，自建中转时修改）
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 默认模型
#   deepseek-chat     —— 日常对话首选，性价比高
#   deepseek-reasoner —— R1 推理模型，适合数学/逻辑/代码任务
DEEPSEEK_MODEL=deepseek-chat
```

4. **重启服务**：环境变量仅在 Next.js 启动时加载，修改后需重启 `pnpm dev`

#### 计费说明

- DeepSeek 按 token 用量计费，具体价格参考 [官方定价页](https://platform.deepseek.com/pricing)
- 新用户注册通常有免费额度
- 建议在控制台设置用量提醒，避免超额

---

### 2. Tavily API 配置

Tavily 是专为 AI 优化的搜索引擎，提供高质量的联网搜索结果。

#### 步骤

1. **注册账号**：访问 [Tavily 官网](https://app.tavily.com/) 注册账号
2. **获取 API Key**：登录后在 Dashboard 中找到 API Key（格式为 `tvly-` 开头的字符串）
3. **配置环境变量**：在 `.env.local` 文件中添加：

```env
# Tavily 搜索 API 密钥（可选，不配置则联网搜索功能不可用）
TAVILY_API_KEY=tvly-你的API密钥
```

4. **重启服务**：修改环境变量后需重启 Next.js 服务

#### 使用说明

- 配置后，在 AI 对话界面开启「联网搜索」开关即可实时搜索网络信息
- 搜索结果会自动作为参考来源融入 AI 回答中
- 单次搜索默认返回 6 条结果，最多 10 条
- 如未配置 Tavily，联网搜索功能会静默返回空结果，不影响正常对话

#### 备选方案：SearXNG

如果不想使用 Tavily，也可以配置自建的 SearXNG 实例作为降级方案：

```env
# SearXNG 自建实例地址（降级备选）
SEARXNG_BASE_URL=http://127.0.0.1:8080
```

优先级：Tavily > SearXNG > 无搜索

---

### 3. 认证与数据库

```env
# AI 后端模式：B = 本地直连模型
NEXT_PUBLIC_AI_BACKEND_MODE=B

# NextAuth 认证密钥（必填，生产环境必须修改）
# 生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=你的认证密钥

# SQLite 数据库路径（必填）
DATABASE_URL=file:./prisma/dev.db
```

初始化数据库：

```bash
# 生成 Prisma Client
pnpm prisma generate

# 推送 schema 到数据库
pnpm prisma db push
```

---

### 4. SMTP 邮件服务（可选）

配置 SMTP 后，找回密码功能会通过邮件发送重置链接；未配置时，接口会直接返回 token（仅用于开发调试）。

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM="深知助手 <noreply@example.com>"
```

---

### 5. 演示模式（可选）

开启后，访问 AI 助手页会自动以演示账号登录，方便演示或快速体验。

```env
# 是否启用演示模式（true / false）
NEXT_PUBLIC_DEMO_MODE=false

# 演示账号用户名（前端可读）
NEXT_PUBLIC_DEMO_USER=demo

# 演示账号密码（仅服务端可读，需确保该账号已在数据库中注册）
DEMO_PASS=demo-password-change-me
```

---

> 完整的环境变量配置请参考 `.env.example` 文件。

---

## 安全说明

### API 密钥安全

- ✅ **所有 API 密钥均为服务端环境变量**（无 `NEXT_PUBLIC_` 前缀），永远不会注入到浏览器 JS 中
- ✅ `.env.local` 已被 `.gitignore` 排除，真实密钥不会进入 Git 仓库
- ✅ 代码中无任何硬编码的密钥或凭证
- ❌ **严禁**将 `.env.local` 或任何包含真实密钥的文件提交到 Git
- ❌ **严禁**在前端代码（`use client` 组件）中读取 `DEEPSEEK_API_KEY` 等敏感变量

### 数据安全

- 用户密码使用 bcrypt（rounds=10）哈希存储，永不返回明文
- SQLite 数据库文件（`prisma/dev.db`）已被 `.gitignore` 排除
- 上传的附件临时存储在 `tmp_uploads/`，解析后立即删除，不进入 Git
- 找回密码 token 一次性有效，过期自动失效

---

## 目录结构

```
feat-ai-agent-B/
├── app/                           # 路由页面（App Router）
│   ├── agents/                    # AI 研究助手模块
│   │   ├── ask/                   #   AI 对话页
│   │   ├── deep-research/         #   深度研究页
│   │   ├── auto-research/         #   自动研究页
│   │   └── deep-search/           #   深度搜索页
│   ├── search/                    # 搜索结果页
│   ├── papers/[id]/               # 论文详情页（含图谱子页）
│   ├── scholars/[id]/             # 学者详情页
│   ├── knowledge/                 # 知识仪表盘模块
│   │   ├── papers/                #   论文库
│   │   ├── scholars/              #   学者库（含图谱子页）
│   │   ├── institutions/          #   科研机构
│   │   ├── funding/               #   资助项目
│   │   ├── patents/               #   专利库
│   │   ├── graph/                 #   全局知识图谱
│   │   └── page.tsx               #   仪表盘首页
│   ├── projects/                  # 科研项目
│   ├── submit/                    # 投稿指南
│   ├── login/                     # 登录页
│   ├── register/                  # 注册页
│   ├── reset-password/            # 找回密码页
│   ├── settings/                  # 设置页
│   └── api/                       # API 路由
│       ├── ai/chat/               #   AI 对话（DeepSeek 流式）
│       ├── web-search/            #   联网搜索（Tavily / SearXNG）
│       ├── sessions/              #   会话管理（列表/详情/消息/收藏）
│       ├── uploads/               #   附件上传与解析
│       ├── users/                 #   用户（注册/找回密码/重置密码）
│       ├── auth/[...nextauth]/    #   NextAuth 认证
│       └── v1/[...path]/          #   A 模块 API 兼容代理
├── components/                    # 组件
│   ├── ui/                        #   基础 UI 组件（shadcn 风格）
│   ├── layout/                    #   布局组件（壳/侧边栏/Logo/主题切换）
│   ├── auth/                      #   认证组件（登录弹窗）
│   └── features/                  #   业务组件
│       ├── agent/                 #     AI 对话相关
│       ├── deep-research/         #     深度研究相关
│       ├── graph/                 #     知识图谱相关
│       ├── search/                #     搜索结果相关
│       ├── paper/                 #     论文详情相关
│       ├── scholar/               #     学者画像相关
│       ├── institution/           #     科研机构相关
│       ├── knowledge/             #     知识仪表盘相关
│       ├── submit/                #     投稿指南相关
│       └── research/              #     研究流水线相关
├── lib/                           # 工具库
│   ├── api/                       #   API 封装
│   ├── c-server/                  #   C 模块服务端逻辑（附件解析/联网搜索）
│   ├── data/                      #   Mock 数据（论文/学者/资助/专利/项目等）
│   ├── ask/                       #   A 模块兼容层
│   ├── chat-stream.ts             #   流式对话解析
│   ├── chat-prompt.ts             #   对话 Prompt 构建
│   ├── markdown-content.tsx       #   Markdown 渲染
│   ├── citations.tsx              #   引用标注
│   ├── graph-layout.ts            #   图谱布局算法
│   ├── db.ts                      #   Prisma Client 单例
│   ├── utils.ts                   #   通用工具
│   └── constants.ts               #   全局常量
├── hooks/                         # 自定义 Hooks
│   └── use-debounce.ts
├── prisma/                        # 数据库
│   ├── schema.prisma              #   Schema 定义
│   └── migrations/                #   迁移文件
├── providers/                     # React Context Providers
│   ├── auth-provider.tsx
│   └── query-provider.tsx
├── stores/                        # Zustand 状态管理
│   ├── auth.ts
│   ├── composer.ts
│   ├── sidebar.ts
│   ├── theme.ts
│   └── user-preferences.ts
├── types/                         # TypeScript 类型定义
├── scripts/                       # 启动脚本（Windows bat）
├── docs/                          # 文档
├── brand/                         # 品牌资产（Logo 日/夜版）
├── .env.example                   # 环境变量示例（安全模板）
├── .gitignore                     # Git 忽略规则
├── Dockerfile                     # Docker 多阶段构建
├── docker-compose.yml             # Docker Compose 配置
├── .github/workflows/deploy.yml   # GitHub Actions CI/CD
└── package.json
```

---

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t shenzhi-frontend .

# 运行容器
docker run -p 3000:3000 \
  -e DEEPSEEK_API_KEY=sk-xxx \
  -e TAVILY_API_KEY=tvly-xxx \
  -e AUTH_SECRET=your-secret \
  -e DATABASE_URL=file:./prisma/dev.db \
  shenzhi-frontend
```

### Docker Compose 部署

```bash
docker compose up -d
```

### GitHub Actions 自动部署

仓库已配置 CI/CD 工作流（`.github/workflows/deploy.yml`）：

- 推送到 `main` 分支自动触发构建
- 构建 Docker 镜像并推送到 GHCR
- Trivy 安全扫描（漏洞 + 敏感信息）
- Watchtower 自动拉取最新镜像部署

> 注意：部署前需将 `ghcr.io/your-org/shenzhi-frontend` 替换为你自己的镜像仓库地址。

---

## 许可证

本项目为内部研发项目，未经授权不得外传。
