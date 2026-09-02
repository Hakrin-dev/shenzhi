#!/usr/bin/env bash
# 深知 · 远程演示一键启动:本地生产服务 + 内网穿透隧道
# 用法:
#   scripts/demo-remote.sh                      # 起服务 + Tailscale Funnel(Windows 侧,固定 *.ts.net 域名)
#   scripts/demo-remote.sh --build              # 先重新构建再启动
#   scripts/demo-remote.sh --tunnel=cloudflared # Funnel 不可用时切 Cloudflare 快速隧道
#   scripts/demo-remote.sh --tunnel=ngrok       # 备选 ngrok(export NGROK_DOMAIN=<固定域名>)
#   PORT=3100 scripts/demo-remote.sh            # 自定义端口
# 建议在 tmux 中运行:tmux new -s demo
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
TUNNEL="tailscale"
DO_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --build) DO_BUILD=1 ;;
    --tunnel=*) TUNNEL="${arg#*=}" ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "✗ 未知参数: $arg(支持 --build / --tunnel=tailscale|cloudflared|ngrok)"; exit 1 ;;
  esac
done

# Windows 侧 Tailscale,绝对路径直调(不依赖 PATH、不用软链接)
TS_BIN="/mnt/c/Program Files/Tailscale/tailscale.exe"

# 兼容 Windows 侧安装的 .exe(WSL PATH 互通)
resolve() { command -v "$1" 2>/dev/null || command -v "$1.exe" 2>/dev/null || true; }

# 1. 构建(显式要求或产物缺失时)
if [[ "$DO_BUILD" == 1 || ! -f .next/BUILD_ID ]]; then
  echo "▸ 构建生产产物…"
  pnpm build
fi

# 2. 后台启动生产服务(setsid 独立进程组,便于整组清理 pnpm→next→next-server)
# 注:next start 会对 output:'standalone' 配置打印警告,本地演示可忽略(服务正常工作)
echo "▸ 启动生产服务(端口 $PORT)…"
setsid pnpm start -p "$PORT" &
SERVER_PID=$!

CLEANED=0
cleanup() {
  [[ "$CLEANED" == 1 ]] && return
  CLEANED=1
  echo
  echo "▸ 清理:停止本地服务与隧道…"
  kill -- -"$SERVER_PID" 2>/dev/null || true
  # 安全保险:确保 Funnel 公网入口已关(防止异常退出后仍暴露公网)
  if [[ "$TUNNEL" == "tailscale" && -f "$TS_BIN" ]]; then
    "$TS_BIN" funnel --https=443 off >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

# 3. 等待服务就绪
echo -n "▸ 等待服务就绪"
READY=0
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:$PORT" >/dev/null 2>&1; then READY=1; break; fi
  echo -n "."; sleep 1
done
[[ "$READY" == 1 ]] || { echo; echo "✗ 服务 60s 内未就绪,请检查上方日志"; exit 1; }
echo " OK → http://localhost:$PORT"

# 4. 前台启动隧道(Ctrl-C 触发 trap 统一清理)
case "$TUNNEL" in
  tailscale)
    [[ -f "$TS_BIN" ]] || { echo "✗ 未找到 Windows 侧 Tailscale($TS_BIN),安装见 docs/local-demo-plan.md §3"; exit 1; }
    # 从 tailscale status 取本机 DNS 名作为公网地址(固定域名)
    TS_DNS="$("$TS_BIN" status --json 2>/dev/null | grep -m1 -oE '"DNSName": *"[^"]+"' | grep -oE '[a-zA-Z0-9.-]+\.ts\.net' || true)"
    echo "▸ Tailscale Funnel(443 → localhost:$PORT)→ ${TS_DNS:+https://$TS_DNS}"
    echo "  首次运行会自动签发 TLS 证书(约几秒);前台日志即访客请求记录"
    "$TS_BIN" funnel --https=443 "$PORT" || true
    ;;
  cloudflared)
    CF_BIN="$(resolve cloudflared)"
    [[ -n "$CF_BIN" ]] || { echo "✗ 未找到 cloudflared,安装步骤见 docs/local-demo-plan.md §3"; exit 1; }
    echo "▸ Cloudflare 快速隧道(随机 *.trycloudflare.com 域名,见下方输出)…"
    "$CF_BIN" tunnel --url "http://localhost:$PORT" || true
    ;;
  ngrok)
    NGROK_BIN="$(resolve ngrok)"
    [[ -n "$NGROK_BIN" ]] || { echo "✗ 未找到 ngrok,安装步骤见 docs/local-demo-plan.md §3"; exit 1; }
    if [[ -n "${NGROK_DOMAIN:-}" ]]; then
      echo "▸ ngrok 隧道(固定域名)→ https://$NGROK_DOMAIN"
      "$NGROK_BIN" http --url="$NGROK_DOMAIN" "$PORT" || true
    else
      echo "▸ ngrok 隧道(随机域名;export NGROK_DOMAIN=<认领的固定域名> 可固定)"
      "$NGROK_BIN" http "$PORT" || true
    fi
    ;;
  *)
    echo "✗ 未知隧道: $TUNNEL(支持 tailscale / cloudflared / ngrok)"; exit 1 ;;
esac
