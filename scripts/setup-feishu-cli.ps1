# 首次配置飞书 CLI（仅需一次）
# 用法：.\scripts\setup-feishu-cli.ps1

$ErrorActionPreference = "Stop"
$Cli = @('npx', '--yes', '@larksuite/cli@latest')

Write-Host "=== 飞书 CLI 首次配置 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "步骤 1/2：在浏览器中创建/绑定飞书应用" -ForegroundColor Yellow
Write-Host "  下方会出现链接与二维码，请用飞书账号打开并完成授权。"
Write-Host ""

& $Cli config init --new
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "步骤 2/2：用户登录（文档读写权限）" -ForegroundColor Yellow
& $Cli auth login --recommend
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
& $Cli auth status
Write-Host ""
Write-Host "配置完成。运行同步：" -ForegroundColor Green
Write-Host "  .\scripts\sync-feishu-progress.ps1"
