# 释放本地开发端口 3000（Next.js）与 8000（FastAPI）
param(
    [int[]]$Ports = @(3000, 8000)
)

foreach ($port in $Ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        $processId = $conn.OwningProcess
        if ($processId -and $processId -ne 0) {
            Write-Host "停止端口 $port 上的进程 PID=$processId"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}
