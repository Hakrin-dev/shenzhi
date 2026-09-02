# 深知 ShenZhi · Research OS

> 深知是面向人工智能领域学术科研的**专业可信知识智能体服务平台**,提供论文检索、投稿筛选,以及用于 Deep Research 与 Auto Research 的知识智能体服务。
>
> 本目录是其前端工程:`prototype_v1` SVG 原型的正式 React 实现,**9 个页面已全部完成转换**(7 张 SVG + 2 个知识图谱页),并落地了品牌体系与日/夜模式。

---

## 快速开始

```bash
cd apps/web
pnpm install        # pnpm 11:构建脚本白名单见 pnpm-workspace.yaml(sharp)
pnpm dev            # 开发(--turbopack)
pnpm typecheck      # TypeScript
pnpm lint           # ESLint
pnpm test           # 认证、配置与 Chat 协议测试
pnpm build          # 生产构建
pnpm start          # 启动生产服务
```

AI 生成（可选，问 AI 需要）:

```bash
cd apps/backend
pip install -r requirements.txt
cp .env.example .env  # 在 .env 配置模型和可选搜索 Key
uvicorn app.main:app --env-file .env --reload --port 8000
```

Web 环境变量 `BUSINESS_BACKEND_URL=http://127.0.0.1:8000`（仅服务端）。项目介绍见 [docs/dev/项目介绍.md](docs/dev/项目介绍.md)，进度见 [docs/dev/开发日志.md](docs/dev/开发日志.md)。

打开 http://localhost:3000 。URL 加 `?theme=dark` / `?theme=light` 可强制日/夜模式(用于调试与分享)。

> **Turbopack 恢复说明**:本副本运行于 WSL2,dev/build 均使用 `--turbopack`(见 package.json)。Windows 侧曾因智能应用控制拦截 Turbopack 原生二进制而临时改用 `--webpack`,该问题仅存在于 Windows 环境,当前副本不受影响。

---

## 部署(已上线 ✅)

**线上地址:http://47.238.241.77**(阿里云香港 ECS,免备案)

```
git push origin main
   │
   ▼
GitHub Actions:docker build → 推 GHCR(私有)→ Trivy 安全扫描 → SSH 到 ECS 部署
   │
   ▼
ECS:/opt/shenzhi, docker compose(80 → web:3000),约 1~3 分钟自动上线
```

- **日常迭代 = `git push`**,无需其他操作;Actions 页面可看每次部署状态
- 镜像:`ghcr.io/hakrin-dev/shenzhi-frontend`(私有,ECS 凭 GHCR_PAT 拉取)
- `infra/docker/web.Dockerfile` 多阶段 + `output: 'standalone'`,镜像 ~150MB;构建在 CI 完成,ECS 只拉取运行
- 完整运维文档(Secrets 配置、回滚、扩展后端/数据库):[infra/README.md](infra/README.md)

---

## 页面路由(已实现 ✅)

| 路由 | 页面 | 对应原型 | 实现位置 |
|------|------|----------|----------|
| `/` | 主发现页(搜索 + Feed 流) | 深知-主发现页.svg | [HomePage.tsx](apps/web/features/home/HomePage.tsx) |
| `/submit` | 投稿详情页(期刊/会议 + 倒计时) | 深知-投稿详情页.svg | [SubmitPage.tsx](apps/web/features/submit/SubmitPage.tsx) |
| `/papers/[id]` | 论文详情页(沉浸式阅读器) | 深知-论文详情页.svg | [PaperDetailPage.tsx](apps/web/features/papers/[id]/PaperDetailPage.tsx) |
| `/scholars` | 学者画像(检索/排序/关注) | 深知-学者画像页.svg | [page.tsx](apps/web/app/scholars/page.tsx) |
| `/scholars/[id]` | 学者详情(引用图表/发表列表) | 深知-学者详情页.svg | [ScholarDetailPage.tsx](apps/web/features/scholars/[id]/ScholarDetailPage.tsx) |
| `/knowledge` | 知识库(文献库 + 在读表格) | 深知-知识库页面.svg | [KnowledgePage.tsx](apps/web/features/knowledge/KnowledgePage.tsx) |
| `/papers/[id]/graph` | 公域知识图谱(引用关系三栏页) | 知识图谱样页.png | [PaperGraphPage.tsx](apps/web/features/papers/[id]/graph/PaperGraphPage.tsx) |
| `/knowledge/graph` | 私域知识图谱(发表×收藏分层双色) | 知识图谱样页.png | [KnowledgeGraphPage.tsx](apps/web/features/knowledge/graph/KnowledgeGraphPage.tsx) |
| `/agents` | AI 研究助手(深度研究对话) | 深知-AI研究助手.svg | [ChatPage.tsx](apps/web/features/chat/ChatPage.tsx) |

导航联动与 `prototype_v1.html` 热区一致:搜索提交 → `/agents`;论文卡片 → `/papers/[id]`;作者/学者 → `/scholars/[id]`。

---

Chat 已统一为 `features/chat → clients/backend → /api/v1 BFF → FastAPI`；`/agents` 与 `/agents/ask` 共用实现。
当前 Session 为单进程临时内存数据，不绑定新的账号体系。架构、SSE、配置与边界见 [docs/chat/README.md](docs/chat/README.md)。

Knowledge Base 是外部 Research Capability，FastAPI 后端统一通过
`apps/backend/app/integrations/knowledge/` 接入。当前只承诺 Search、Paper Detail、
Paper Graph 三项能力，不表述为完整知识底座已接入，也不在本轮接入 Chat Tool。

## 技术栈(当前实际)

| 类别 | 技术 | 状态 |
|------|------|------|
| 框架 | Next.js 16(App Router)+ React 19 + TypeScript | ✅ |
| 样式 | Tailwind CSS 4(CSS-first `@theme`)+ tw-animate-css | ✅ |
| 组件 | 手写 shadcn 风格 UI 原语(cva 变体) | ✅ |
| 服务端数据 | TanStack Query v5(含 placeholderData) | ✅(mock 数据) |
| 客户端状态 | Zustand v5 + persist(点赞/收藏/关注) | ✅ |
| 表单 | Zod(搜索校验 schema,当前尚未接入表单组件) | 🟡 |
| 动效 | Framer Motion(入场动画) | ✅ |
| 图标 | Lucide React | ✅ |
| 包管理 | pnpm 11 | ✅ |
| 认证与数据 | Better Auth 1.6.28 + PostgreSQL (`pg`) | ✅ 代码已接入；生产配置待完成 |
| 编辑器 / 可视化 / 测试 | TipTap、D3.js、Node.js `node:test`(认证/配置) | 🟡 业务数据层与浏览器测试仍待接入 |

## 目录结构(实际)

```
shenzhi/
├── apps/
│   ├── web/                  # Next.js Web；app 为薄路由，features 为页面实现
│   └── backend/              # FastAPI：Chat / 检索 / Knowledge Capability / 模型流 / 搜索 / 附件解析
├── infra/                    # Dockerfile、Compose 与部署文档
├── tests/visual/             # 页面、主题与图谱截图验证脚本
├── tools/brand/              # 品牌资源处理工具
├── docs/                     # PRD、开发文档、设计材料与原型
├── .github/workflows/        # deploy.yml:构建 Web 镜像并推送 GHCR
└── README.md
```

## 品牌与设计令牌

- **标识**:用户书法定稿「深知」日/夜双版(白字黑底 / 黑字白底),成品直用;随主题 CSS 切换,无 JS 闪烁。运行时资产位于 `apps/web/public/brand/`,资产管线见 `tools/brand/process_logo.py`。
- **配色「深识」体系**:主色深识蓝 `#002FA7`(夜间调浅 `#5B84F1`);辅助灵犀紫 / 探索青 / 桂冠金 `#f3d029`(金底一律配墨字)。
- **日/夜模式**:`apps/web/styles/globals.css` 用 `.dark` 块重定义同名令牌,组件零改动;`layout.tsx` 内联脚本首屏定主题(`?theme=` > localStorage `shenzhi-theme` > 系统偏好);切换按钮在侧边栏 Logo 右侧与移动端顶栏。
- 完整规范:见本地 `docs/superpowers/specs/`(仅本地工作文档,不入库)

---

## 开发规范

### 命名约定

| 目标 | 约定 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `paper-card.tsx`、`use-debounce.ts` |
| 组件名 | PascalCase | `PaperCard`、`SearchHero` |
| 函数/变量 | camelCase | `getPaperById` |
| 类型/接口 | PascalCase | `Paper`、`Scholar` |
| 常量 | UPPER_SNAKE_CASE | `SITE`、`LEVEL_CHIPS` |
| 动态路由 | 方括号 | `[id]` |

### 状态管理分层

```
服务端状态   TanStack Query   → 论文列表等；Chat 使用 Feature hook + Backend Client
客户端全局   Zustand persist  → 点赞/收藏/关注等用户偏好
组件局部     useState         → 输入值、Tab 切换、面板显隐
URL 状态     useSearchParams  → 搜索关键词、筛选条件、?theme 调试参数
```

### 颜色使用纪律

- 一律走 `globals.css` 令牌(`bg-card`、`text-ink`、`bg-primary` …),**禁止在组件里写死页面结构色**;少数语义徽章色(琥珀/绿/紫)必须成对提供 `dark:` 变体。
- 金(`brand-gold`)只作底色/图标色并配墨字,不作正文文字色(明度高,可读性差)。

### 数据约定

- `apps/web/lib/data/*.ts` 的内容逐字提取自 SVG 原型,属展示用 mock;接真实后端时替换为 `apps/web/clients/backend/` + FastAPI,组件接口保持不变。

---

## 验证工具

```bash
cd apps/web
pnpm build && pnpm start -p 3100      # 先起生产服务(动画页截图更稳定)
cd ../..
python tests/visual/shot_pages.py      # 全页面截图 → %TEMP%(f_home / f_submit / f_paper / f_scholars / f_scholar_detail / f_knowledge / f_agents)
python tests/visual/shot_themes.py     # 日/夜对比截图 → %TEMP%(theme-*-day/night.png)
python tests/visual/shot_graph.py      # 知识图谱页日/夜截图
```

依赖本机 Edge headless;截图时机过早可能捕获到 Framer Motion 入场动画半途(伪影,非缺陷),以 SSR HTML 内容为准。

## 与原型的关系

| 维度 | prototype_v0 / v1 | apps/web |
|------|-------------------|-------------|
| 定位 | 原型探索 | 工程化前端(当前开发基准) |
| 页面 | 7 张 SVG + HTML 热区 | 9 路由完整覆盖(7 SVG + 2 图谱页),热区已转为真实导航 |
| 数据 | 静态 | mock(逐字提取)→ 规划 Server Actions + DB |
| 状态 | 无 | TanStack Query + Zustand persist + URL state |
| 主题 | 无 | 日/夜双模式 + 品牌令牌 |
