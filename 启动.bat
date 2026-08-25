@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title 深知 ShenZhi 本地开发

set "ROOT=%~dp0"
set "WEB=%ROOT%apps\web"
set "BACKEND=%ROOT%apps\backend"
set "APP_URL=http://localhost:3000"
set "API_URL=http://127.0.0.1:8000"

where node >nul 2>&1
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 https://nodejs.org/
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo 未检测到 Python，FastAPI 后端需要 Python 3.10+。
  pause
  exit /b 1
)

set "PM="
where pnpm >nul 2>&1
if not errorlevel 1 set "PM=pnpm"
if not defined PM (
  where npm.cmd >nul 2>&1
  if not errorlevel 1 set "PM=npm.cmd"
)
if not defined PM (
  echo 未检测到 pnpm 或 npm。
  pause
  exit /b 1
)

REM Web 环境：指向本地 FastAPI（仅服务端，勿用 NEXT_PUBLIC_）
if not exist "%WEB%\.env.local" (
  echo 未找到 apps\web\.env.local，正在从 .env.example 复制...
  copy /Y "%WEB%\.env.example" "%WEB%\.env.local" >nul
)
findstr /C:"BUSINESS_BACKEND_URL=http://127.0.0.1:8000" "%WEB%\.env.local" >nul 2>&1
if errorlevel 1 (
  echo 提示：请在 apps\web\.env.local 中设置 BUSINESS_BACKEND_URL=http://127.0.0.1:8000
)

REM --- Web 依赖 ---
pushd "%WEB%"
if /i "%PM%"=="pnpm" (
  if not exist "node_modules\" (
    echo 正在安装 Web 依赖...
    call pnpm approve-builds --all >nul 2>&1
    call pnpm install --fetch-timeout 15000
    if errorlevel 1 call pnpm install --registry https://registry.npmmirror.com
  ) else (
    REM 确保 native 模块（prisma / better-sqlite3）已批准并编译
    call pnpm approve-builds --all >nul 2>&1
    call pnpm install --fetch-timeout 15000
    if errorlevel 1 (
      echo 依赖校验失败，尝试重新安装...
      call pnpm install --registry https://registry.npmmirror.com
    )
  )
) else (
  if not exist "node_modules\" (
    echo 正在安装 Web 依赖...
    call npm.cmd install --fetch-timeout=15000 --fetch-retries=1
    if errorlevel 1 call npm.cmd install --registry https://registry.npmmirror.com
  )
)
popd
if errorlevel 1 (
  echo Web 依赖安装失败。若 pnpm 报 ERR_PNPM_IGNORED_BUILDS，请检查 apps\web\pnpm-workspace.yaml 中 allowBuilds。
  pause
  exit /b 1
)

REM --- FastAPI 虚拟环境与依赖 ---
if not exist "%BACKEND%\.venv\" (
  echo 正在创建 Python 虚拟环境...
  pushd "%BACKEND%"
  python -m venv .venv
  popd
  if errorlevel 1 (
    echo 创建虚拟环境失败。
    pause
    exit /b 1
  )
)

if not exist "%BACKEND%\.venv\Lib\site-packages\fastapi" (
  echo 正在安装 FastAPI 依赖...
  pushd "%BACKEND%"
  call .venv\Scripts\python.exe -m pip install -r requirements.txt -q
  popd
  if errorlevel 1 (
    echo FastAPI 依赖安装失败。
    pause
    exit /b 1
  )
)

REM --- 释放占用端口（可选，避免旧进程残留）---
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-dev-services.ps1" >nul 2>&1

echo.
echo ========================================
echo  深知 ShenZhi 本地开发
echo  前端 Next.js  %APP_URL%
echo  后端 FastAPI  %API_URL%
echo ========================================
echo.

REM FastAPI 单独窗口
start "深知-FastAPI" cmd /k "cd /d "%BACKEND%" && .venv\Scripts\activate && echo FastAPI: %API_URL% && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

REM 等待后端就绪（最多 30 秒）
echo 等待 FastAPI 就绪...
powershell -NoProfile -Command ^
  "$u='%API_URL%/health'; $ok=$false; 1..30 | %% { try { $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){$ok=$true; break} } catch{}; Start-Sleep -Seconds 1 }; if(-not $ok){ Write-Host '警告: FastAPI 尚未就绪，请查看「深知-FastAPI」窗口' -ForegroundColor Yellow } else { Write-Host 'FastAPI 已就绪' -ForegroundColor Green }"

echo.
echo 正在启动 Next.js（关闭本窗口将停止前端）...
echo.

pushd "%WEB%"
if /i "%PM%"=="pnpm" (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start %APP_URL%"
  call pnpm dev
) else (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start %APP_URL%"
  call npm.cmd run dev
)
popd

echo.
echo 前端已停止。正在释放端口...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-dev-services.ps1"
pause
