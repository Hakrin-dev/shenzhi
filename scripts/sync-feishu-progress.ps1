# 将 docs/dev/AI科研助手页面进度.md 同步到飞书知识库页面
# 依赖：npx @larksuite/cli（首次需 lark-cli config init + auth login）
# 用法：.\scripts\sync-feishu-progress.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DocUrl = "https://fcnwq2xz3qtd.feishu.cn/wiki/IpUJwDQK2iZBICkRMP6ciCeMnxb"
$SourceMd = Join-Path $Root "docs\dev\AI科研助手页面进度.md"
$SyncMd = Join-Path $Root "docs\dev\.feishu-sync-body.md"
$Cli = "npx --yes @larksuite/cli@latest"

Set-Location $Root

Write-Host "检查 lark-cli 配置..." -ForegroundColor Cyan
$statusJson = & npx --yes @larksuite/cli@latest auth status 2>&1 | Out-String
if ($statusJson -notmatch '"user"[\s\S]*"status"\s*:\s*"ready"') {
    Write-Host "未配置或未登录。请先执行：" -ForegroundColor Yellow
    Write-Host "  .\scripts\setup-feishu-cli.ps1"
    exit 1
}

Write-Host "正在覆盖飞书文档..." -ForegroundColor Cyan
Write-Host "  $DocUrl"

if (-not (Test-Path $SourceMd)) {
    Write-Host "找不到源文件: $SourceMd" -ForegroundColor Red
    exit 1
}

# 去掉文件头说明，正文从「## 深知 AI 助手 · 项目介绍」起
$lines = Get-Content $SourceMd -Encoding UTF8
$start = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^## 深知 AI 助手') { $start = $i; break }
}
$body = ($lines | Select-Object -Skip $start) -join "`n"
[System.IO.File]::WriteAllText($SyncMd, $body, [System.Text.UTF8Encoding]::new($false))

$relSync = "docs/dev/.feishu-sync-body.md"
& npx --yes @larksuite/cli@latest docs +update --doc $DocUrl --command overwrite --doc-format markdown --content "@$relSync" --as user
if ($LASTEXITCODE -ne 0) {
    Write-Host "同步失败，请确认已登录且有文档编辑权限。" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "飞书进度页已同步完成。" -ForegroundColor Green
