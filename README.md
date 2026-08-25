# 深知 ShenZhi · AI 研究助手（B 模块）

> **上传日期**：2026-08-24
>
> 深知是面向人工智能领域学术科研的**专业可信知识智能体服务平台**。本仓库为 B 模块（前端 + 本地直连大模型），提供 AI 研究助手对话、深度研究、联网搜索等核心能力。

---

## 实现的功能

### 核心功能

| 功能模块 | 描述 | 状态 |
|----------|------|------|
| **AI 对话助手** | 支持流式对话，4 种回复风格（快速 / 深度 / 启发 / 批判），实时思考链展示 | ✅ |
| **DeepSeek 模型接入** | 直连 DeepSeek API，支持 deepseek-chat / deepseek-reasoner（R1 推理模型） | ✅ |
| **联网搜索** | 集成 Tavily 搜索引擎，对话中可开启联网搜索获取实时信息 | ✅ |
| **附件解析** | 支持 PDF / Markdown / TXT 附件上传与内容解析，融入对话上下文 | ✅ |
| **用户认证** | 注册 / 登录 / 找回密码，基于 NextAuth + bcrypt | ✅ |
| **会话管理** | 多会话历史、消息收藏、分享链接（只读 Token） | ✅ |
| **深度研究** | Deep Research 报告生成与播放（规划中） | 🚧 |
| **日/夜模式** | 完整的明暗双主题切换，品牌设计令牌体系 | ✅ |

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + tw-animate-css |
| 状态管理 | TanStack Query v5 + Zustand v5 |
| AI 模型 | DeepSeek API（OpenAI 兼容协议） |
| 联网搜索 | Tavily Search API |
| 数据库 | SQLite + Prisma ORM |
| 认证 | NextAuth v5 + bcryptjs |
| 包管理 | pnpm 11 |
| 部署 | Docker + GitHub Actions + GHCR |

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

### 3. 其他环境变量

完整的环境变量配置请参考 `.env.example` 文件。以下为必填项：

```env
# AI 后端模式：B = 本地直连模型
NEXT_PUBLIC_AI_BACKEND_MODE=B

# NextAuth 认证密钥（生产环境必须修改）
# 生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=你的认证密钥

# SQLite 数据库路径
DATABASE_URL=file:./prisma/dev.db
```

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

---

## 目录结构

```
feat-ai-agent-B/
├── app/                      # 路由页面
│   ├── agents/               # AI 研究助手页
│   ├── login/                # 登录页
│   ├── register/             # 注册页
│   ├── reset-password/       # 找回密码页
│   ├── settings/             # 设置页
│   ├── api/                  # API 路由
│   │   ├── ai/chat/          # AI 对话接口（DeepSeek 流式）
│   │   └── web-search/       # 联网搜索接口（Tavily）
│   └── ...
├── components/               # 组件
│   ├── ui/                   # 基础 UI 组件
│   ├── layout/               # 布局组件
│   └── features/             # 业务组件
├── lib/                      # 工具库
│   ├── api/                  # API 封装
│   ├── c-server/             # C 模块服务端逻辑
│   ├── data/                 # Mock 数据
│   └── ...
├── prisma/                   # 数据库 Schema
├── providers/                # React Context Providers
├── stores/                   # Zustand 状态管理
├── types/                    # TypeScript 类型定义
├── .env.example              # 环境变量示例（安全模板）
├── .gitignore                # Git 忽略规则
├── Dockerfile                # Docker 多阶段构建
├── docker-compose.yml        # Docker Compose 配置
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
  shenzhi-frontend
```

### GitHub Actions 自动部署

仓库已配置 CI/CD 工作流（`.github/workflows/deploy.yml`）：

- 推送到 `main` 分支自动触发构建
- 构建 Docker 镜像并推送到 GHCR
- Trivy 安全扫描（漏洞 + 敏感信息）
- Watchtower 自动拉取最新镜像部署

---

## 许可证

本项目为内部研发项目，未经授权不得外传。
