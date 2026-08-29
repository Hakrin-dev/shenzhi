# ShenZhi 工程协作规则

本文件适用于整个仓库。进入包含更具体 `AGENTS.md` 的目录时，同时遵循该目录规则。

## 工作原则

- 修改前先阅读相关代码与 `docs/engineering/` 中的说明，优先沿用现有结构、实现和命名。
- 只处理当前任务需要的内容，不进行无关的大范围重构，不擅自建立平行架构或重复实现已有能力。
- 保持 Next.js 与 FastAPI 的职责边界：Web 层负责页面、交互及框架相关能力，核心业务逻辑与数据处理由 FastAPI 承载。
- 页面保持轻量，业务逻辑放入对应 Feature；后端或外部服务调用通过现有 Service、Client 或 Adapter 边界完成。
- 科研能力和第三方服务不得直接绑定页面；接口尚未确定时，不虚构稳定能力或生产行为。
- 根据实际复杂度组织代码，不为满足目录形式机械创建没有独立职责的层级、文件或抽象。
- 依赖与工具链沿用仓库现有配置和锁文件；新增依赖前先确认确有必要。
- 完成修改后执行与改动范围相符的检查或测试。架构、公共接口或关键开发方式发生变化时，同步更新相关文档。

若任务要求与现有架构存在明显冲突，先说明冲突及影响，再进行实质性调整。

## Git 与远程同步

- **主项目**：`upstream` → `https://github.com/Hakrin-dev/shenzhi.git`；**fork**：`origin` → `zixuanzheng2007-stack/shenzhi`。
- 日常在 `dev` 上开发，对照 `upstream/dev`；合入主仓库通过 PR（`origin:dev` → `Hakrin-dev/shenzhi:dev`），不直接向 `upstream` push。
- **每次提交后必须同步远程**：`git fetch upstream` → 必要时 rebase → commit → `git push origin dev`；有进行中的 PR 则随 push 自动更新。
- 禁止只留本地 commit 不同步 fork；禁止把 `.env`、密钥、`_local-only/` 纳入版本库。
