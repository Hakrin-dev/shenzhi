param([string]$Ref = "upstream/feat/ai-agent-B")
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Mod = Join-Path $Root "apps\web\modules\ai-agent-b"
$Files = @(
    "app/api/ai/chat/route.ts","app/api/sessions/route.ts","app/api/sessions/[id]/route.ts",
    "app/api/sessions/[id]/messages/route.ts","app/api/uploads/route.ts","app/api/web-search/route.ts",
    "components/features/agent/agent-chat.tsx","components/features/agent/answer-card.tsx",
    "components/features/agent/attachment-menu.tsx","components/features/agent/c-web-search-provider.tsx",
    "components/features/agent/chat-input.tsx","components/features/agent/composer.tsx",
    "components/features/agent/follow-ups.tsx","components/features/agent/reference-grid.tsx",
    "components/features/agent/research-nav.tsx","components/features/agent/session-list.tsx",
    "lib/api/sessions.ts","lib/api/search.ts","lib/chat-stream.ts","lib/chat-prompt.ts",
    "lib/citations.tsx","lib/db.ts","lib/markdown-content.tsx","lib/request.ts",
    "lib/ask/draft.ts","lib/ask/errors.ts","lib/sse.ts",
    "lib/c-server/parse-document.ts","lib/c-server/web-search-client.ts",
    "providers/auth-provider.tsx","providers/query-provider.tsx","stores/composer.ts",
    "prisma/schema.prisma","prisma/migrations/20260821082340_init_p1/migration.sql",
    "prisma/migrations/migration_lock.toml","prisma.config.ts",
    "types/modules.d.ts","types/ai-search.ts","types/index.ts"
)
function Rewrite-BImports([string]$Content) {
    $Content = $Content -replace 'from "@/auth"', 'from "@b/lib/auth-bridge"'
    $Content = $Content -replace 'from "@/lib/generated/prisma', 'from "@b/lib/generated/prisma'
    $Content = $Content -replace 'from "@/lib/api/sessions"', 'from "@b/lib/api/sessions"'
    $Content = $Content -replace 'from "@/lib/api/search"', 'from "@b/lib/api/search"'
    $Content = $Content -replace 'from "@/lib/chat-stream"', 'from "@b/lib/chat-stream"'
    $Content = $Content -replace 'from "@/lib/chat-prompt"', 'from "@b/lib/chat-prompt"'
    $Content = $Content -replace 'from "@/lib/citations"', 'from "@b/lib/citations"'
    $Content = $Content -replace 'from "@/lib/db"', 'from "@b/lib/db"'
    $Content = $Content -replace 'from "@/lib/markdown-content"', 'from "@b/lib/markdown-content"'
    $Content = $Content -replace 'from "@/lib/request"', 'from "@b/lib/request"'
    $Content = $Content -replace 'from "@/lib/ask/', 'from "@b/lib/ask/'
    $Content = $Content -replace 'from "@/lib/sse"', 'from "@b/lib/sse"'
    $Content = $Content -replace 'from "@/lib/c-server/', 'from "@b/lib/c-server/'
    $Content = $Content -replace 'from "@/components/features/agent/', 'from "@b/components/features/agent/'
    $Content = $Content -replace 'from "@/stores/composer"', 'from "@b/stores/composer"'
    $Content = $Content -replace 'from "@/hooks/use-debounce"', 'from "@b/hooks/use-debounce"'
    $Content = $Content -replace 'from "@/types"', 'from "@b/types"'
    $Content = $Content -replace 'from "@/types/', 'from "@b/types/'
    $Content = $Content -replace 'from "@/providers/', 'from "@b/providers/'
    $Content = $Content -replace '"/api/sessions', '"/api/b/sessions'
    $Content = $Content -replace "'/api/sessions", "'/api/b/sessions"
    $Content = $Content -replace '"/api/ai/chat', '"/api/b/ai/chat'
    $Content = $Content -replace "'/api/ai/chat", "'/api/b/ai/chat"
    $Content = $Content -replace '"/api/uploads', '"/api/b/uploads'
    $Content = $Content -replace '"/api/web-search', '"/api/b/web-search'
    return $Content
}
Push-Location $Root
cmd /c "git fetch upstream feat/ai-agent-B 2>nul"
$synced = @()
foreach ($rel in $Files) {
    $dst = Join-Path $Mod ($rel -replace "/", "\")
    $dir = Split-Path $dst -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $tmp = [IO.Path]::GetTempFileName()
    try {
        cmd /c "git -c core.quotepath=false show `"${Ref}:$rel`" > `"$tmp`""
        if ($LASTEXITCODE -ne 0) { continue }
        $content = [IO.File]::ReadAllText($tmp)
    } finally { if (Test-Path $tmp) { Remove-Item $tmp -Force } }
    $content = Rewrite-BImports $content
    if ($rel -eq "prisma.config.ts") {
        $content = $content -replace '\.\./lib/generated/prisma', '../modules/ai-agent-b/lib/generated/prisma'
    }
    [IO.File]::WriteAllText($dst, $content, [Text.UTF8Encoding]::new($false))
    $synced += $rel
}
@{ ref = $Ref; syncedAt = (Get-Date).ToString("o"); files = $synced } | ConvertTo-Json -Depth 3 |
    Set-Content (Join-Path $Mod "SYNC_MANIFEST.json") -Encoding utf8
Write-Host "synced $($synced.Count) B files from GitHub"
Pop-Location
