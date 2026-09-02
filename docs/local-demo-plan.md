# 深知 · 本机演示方案(离线/无网备份:本机 + Tailscale Funnel)

> 状态:**线上主通道已切换为 Vercel**(git push 自动部署,与 scinexus 同构);本方案降级为**离线备份** —— 无网环境、或 Vercel 不可达时的替代路径。
> 一键入口:`pnpm demo`(等价 `scripts/demo-remote.sh`)

## 0. Vercel 主通道(优先使用)

- GitHub 导入仓库即部署,零环境变量(纯前端 mock 数据);`git push` 自动上线
- 带宽评估:shenzhi 静态资源仅 ~6MB,与 scinexus 合计 < 1GB/月,个人免费额度 100GB/月绰绰有余
- 详见 README「部署与演示」章节

## 1. 目标与边界

- 阿里云 ECS 免费额度用尽、实例下线;改为**本机跑生产服务 + Tailscale Funnel** 对外演示。
- 9 个页面均为 mock 数据,离线可演示;仅「搜索联想 / 智能体生成」依赖 `/api/v1` 后端代理,未配置时返回 503 JSON 提示、**页面不崩**(话术见 §6)。

## 2. 工具决策(主备三级)

| 级别 | 工具 | 公网地址 | 启用时机 |
|------|------|----------|----------|
| **主力** | Tailscale Funnel | **固定** `https://<机器名>.<tailnet>.ts.net` | 默认 |
| 即时兜底 | Cloudflare 快速隧道 | 每次随机 `*.trycloudflare.com` | Funnel 故障时 30 秒内切换 |
| 备选 | ngrok 固定域名 / cpolar | 固定 / 免费版约 24h 变 | 观众在国内且 Funnel 明显卡顿 |
| 最终兜底 | 按量付费 ECS | 公网 IP | 演示极其重要时;按小时计费,用完释放,CI 零改动 |

**主力选 Tailscale Funnel 的理由:**
1. **固定域名永不过期**:与机器名绑定(可改名,如 `shenzhi-demo` → `https://shenzhi-demo.tailxxxx.ts.net`),链接可提前发、写进 PPT
2. **无访客警告页**(ngrok 免费档每次有 "Visit Site" 拦截页),观众打开即达,体验干净
3. TLS 证书自动签发(Let's Encrypt),仅对外暴露 443,攻击面小
4. 免费个人计划即可用;账号用 Google/GitHub 一键登录

**已知限制与应对:**
- 仅支持暴露 443 / 8443 / 10000 端口 → 演示用 443,无影响
- 流量经 Tailscale 入口节点中转;**国内观众访问速度取决于入口节点线路** → 卡顿时按 §5 切 cloudflared / cpolar
- 依赖 Tailscale 控制面可用性 → 彩排时验证,兜底路线常备

## 3. 一次性准备

**方案:Windows 侧安装的 Tailscale,WSL 脚本用绝对路径直调 `/mnt/c/Program Files/Tailscale/tailscale.exe`** —— 不改 WSL PATH、不用软链接、不在 WSL 内重复安装。

前置条件(均已就绪 ✅):

1. Windows 侧安装 Tailscale 并登录(官网安装包 或 `winget install tailscale`)
2. Admin Console → **DNS**:MagicDNS 与 HTTPS Certificates 已开启 ✅
3. Funnel 权限已默认开启(`funnel` + 443/8443/10000,无需改 ACL)✅
4. 验证:`"/mnt/c/Program Files/Tailscale/tailscale.exe" status` 在线、`funnel status` 返回 `No serve config` ✅

> 原理:Funnel 代理目标是 Windows 侧 `127.0.0.1:<port>`,经 WSL2 localhost 转发直达 WSL 内的 Next 服务,无需任何额外配置。
> 可选:Admin Console → Machines 里把 `mechrevo-hkr` 改名为 `shenzhi-demo`,公网地址即品牌化;不改则用 `https://mechrevo-hkr.taild0b8bc.ts.net`。
> 生产模式(`pnpm start`)不校验 origin;若用 dev 模式演示,`allowedDevOrigins` 已含 `*.ts.net` 通配,无需再改。

5. (兜底)安装 cloudflared:GitHub Releases 下载安装即可

## 4. 演示日 Runbook

### T-1 天(彩排)

- [ ] `pnpm demo --build` 全流程起一遍(首次运行 Funnel 会自动签发证书,约几秒)
- [ ] 手机开 4G(模拟外网)访问 `https://shenzhi-demo.<tailnet>.ts.net`,走查 9 个页面 + `?theme=dark` 夜模式
- [ ] 把固定域名发给观众;说明「生成类功能依赖后端,本次以前端交互为主」

### T-30 分钟

- [ ] 接电源、关闭系统自动休眠、退出无关大程序
- [ ] 确认 Windows 侧 Tailscale 在线(托盘图标已连接),或执行 `"/mnt/c/Program Files/Tailscale/tailscale.exe" status`
- [ ] 在 **tmux** 里运行 `pnpm demo`(防终端误关/WSL 抖动):
  `tmux new -s demo` → 启动脚本 → `Ctrl-b d` 脱离;`tmux attach -t demo` 随时回来
- [ ] 浏览器预开 tab:首页、计划讲解的页面;脚本前台输出即请求日志(Funnel 逐条打印访客请求)

### 演示中

- 观众每次访问都会在脚本输出里出现日志,可直观看到"对方已打开"
- 观众打不开 → 走 §5 决策树,**现场排查不超过 1 分钟**

### 结束后

- [ ] `Ctrl-C` 停脚本(自动停止 Funnel 转发与本地服务)
- [ ] **必须人工验证**:`tailscale funnel status` 输出 `No serve config`、`ss -tln | grep 3000` 无监听 —— 两者任一残留即为安全事故
- [ ] 公网入口关闭后无暴露面残留

> 🚨 **安全红线(事故教训)**:禁止手动用 `tailscale funnel --bg` 做演示 —— `--bg` 配置**持久化、不随进程退出**,一旦忘记关闭就是公网裸奔;一律使用本脚本的前台模式(退出即关)。

## 5. 故障应急决策树

```
观众打不开页面
 ├─ 本机 localhost:3000 正常吗?
 │    └─ 否 → Ctrl-C 后 pnpm demo --build 重启
 ├─ tailscale status 在线、脚本输出无报错吗?
 │    └─ 否 → Tailscale 掉线:托盘重连 / tailscale up,然后重启脚本
 ├─ 本机开 4G 热点自测 https://<机器名>.<tailnet>.ts.net 通吗?
 │    ├─ 通 → 是对方网络问题,请对方换网络/关代理
 │    └─ 不通 → Funnel 入口线路故障:
 │              pnpm demo --tunnel=cloudflared   ← 秒切,把新 URL 发观众
 │              (仍卡且观众在国内 → 改用 cpolar / ngrok)
 └─ 全不行 → 退回当面/投屏演示(场景 A),不为网络陪葬
```

## 6. 功能边界与演示话术

- 未配置 `API_URL` 时,搜索联想与智能体生成请求会收到 503 提示:
  > "生成服务未配置。设置 API_URL 或 NEXT_PUBLIC_API_URL 后即可转发 /api/v1。"
- 话术:「生成类功能依赖后端服务,本次演示聚焦前端页面与交互;后端接入后这层代理零改动复用。」
- 若未来必须演示生成功能:临时按量开一台只跑后端的 ECS,本地 `.env` 填 `API_URL` 指向它即可,前端无需改动。

## 7. 安全注意

- Funnel URL 是公网地址,**只发给演示对象**;演示结束 `Ctrl-C` 即关闭入口,并验证 `tailscale funnel status` 为 `No serve config`
- **禁止 `funnel --bg`**(配置持久化,忘关即公网暴露);脚本用前台模式统一生命周期,清理时还会兑底执行 `funnel off` 双保险
- tailnet 仅保留本机一台机器(控制台清理不再使用的设备),避免误开入口;Tailscale 账号开启两步验证(演示链接长期固定,账号安全即入口安全)

## 8. 一键脚本说明(`scripts/demo-remote.sh`)

```bash
pnpm demo                          # 起生产服务 + Tailscale Funnel(默认)
pnpm demo --build                  # 先重新构建再启动(改了代码后)
pnpm demo --tunnel=cloudflared     # Funnel 不可用时切 Cloudflare 快速隧道
pnpm demo --tunnel=ngrok           # 备选 ngrok(需 NGROK_DOMAIN 环境变量)
PORT=3100 pnpm demo                # 自定义端口
```

行为:检查/构建产物 → 后台起 `pnpm start`(独立进程组)→ 等待就绪 → 前台起隧道并打印公网地址与请求日志 → `Ctrl-C` 自动清理全部进程。自动兼容 Windows 侧安装的 `tailscale.exe` / `cloudflared.exe` / `ngrok.exe`。

> 想让 Funnel 常驻(不随脚本关闭):`tailscale funnel --bg 3000`,配置持久保存;脚本默认用前台模式以便统一管理生命周期。

## 9. 验证清单

- [ ] `pnpm demo --build` 无报错,`localhost:3000` 9 页全部正常
- [ ] 4G 热点自测:`https://<机器名>.<tailnet>.ts.net` 可访问、日/夜模式正常
- [ ] `Ctrl-C` 后 `localhost:3000` 与 Funnel 均停止(`tailscale funnel status` 显示 `No serve config`,无残留监听端口)
- [ ] cloudflared 兜底路线实际跑通一次
- [ ] 断网演练:除隧道外无外部资源(字体/图片)加载失败

## 10. 场景 A / B(简版保留)

- **A 当面演示/投屏**:`pnpm build && pnpm start` → `http://localhost:3000`
- **B 同局域网**:`pnpm start -H 0.0.0.0`;WSL2 需 Windows 管理员侧 `netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL-IP>` + 防火墙放行;对方访问 `http://<局域网IP>:3000`(若观众也装了 Tailscale 并加入同一 tailnet,直接 `http://<机器名>.<tailnet>.ts.net:3000` + `tailscale serve` 更优雅)

## 11. 本次同步更新的文件

| 文件 | 变更 |
|------|------|
| `README.md` | 「部署与演示」章节:隧道工具改为 Tailscale Funnel |
| `lib/data/projects.ts` | 项目卡片:部署描述改为"本机 + Tailscale Funnel 演示" |
| `deploy/README.md` | 顶部归档声明(ECS 已下线,文档供恢复部署参考) |
| `next.config.mjs` | `allowedDevOrigins` 增加 `*.ts.net` 通配(dev 模式经 Funnel 演示可用) |
| `scripts/demo-remote.sh` | **新增**:一键演示脚本(默认 Funnel,绝对路径直调 Windows 侧 `tailscale.exe`,可切 cloudflared/ngrok);清理函数带 `funnel off` 双保险 |

> ⚠️ ECS 收尾提醒:确认实例已**释放/关机**避免继续计费;GHCR 镜像与 GitHub Actions 流水线保留,日后恢复云端部署零改动(见 `deploy/README.md`)。
