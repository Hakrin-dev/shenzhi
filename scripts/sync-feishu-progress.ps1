# Sync docs/dev/AI科研助手页面进度.md to Feishu wiki
# Usage: .\scripts\sync-feishu-progress.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DocUrl = "https://fcnwq2xz3qtd.feishu.cn/wiki/IpUJwDQK2iZBICkRMP6ciCeMnxb"
$SourceMd = Join-Path $Root "docs\dev\AI科研助手页面进度.md"
$SyncMd = Join-Path $Root "docs\dev\.feishu-sync-body.md"

Set-Location $Root

Write-Host "Checking lark-cli auth..." -ForegroundColor Cyan
$statusJson = & npx '--yes' '@larksuite/cli@latest' auth status 2>&1 | Out-String
if ($statusJson -notmatch '"tokenStatus"\s*:\s*"valid"') {
    Write-Host "Not logged in. Run: .\scripts\setup-feishu-cli.ps1" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $SourceMd)) {
    Write-Host "Missing source: $SourceMd" -ForegroundColor Red
    exit 1
}

Write-Host "Updating Feishu wiki..." -ForegroundColor Cyan
Write-Host "  $DocUrl"

$lines = Get-Content $SourceMd -Encoding UTF8
$start = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^## ') { $start = $i; break }
}
$body = ($lines | Select-Object -Skip $start) -join "`n"
[System.IO.File]::WriteAllText($SyncMd, $body, [System.Text.UTF8Encoding]::new($false))

$relSync = "docs/dev/.feishu-sync-body.md"
& npx '--yes' '@larksuite/cli@latest' docs +update --doc $DocUrl --command overwrite --doc-format markdown --content "@$relSync" --as user
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Feishu sync done." -ForegroundColor Green
