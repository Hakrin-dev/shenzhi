@echo off
chcp 65001 >nul
title 深知 ShenZhi · 全项目开发服务器（前端 + 后端）

:: ============================================================
::  深知 ShenZhi · 全项目一键启动脚本
::  双击即可运行，自动启动前端（Next.js）+ 后端（FastAPI）
:: ============================================================

echo.
echo ============================================================
echo    深知 ShenZhi · 全项目开发服务器
echo    前端（Next.js :3000） + 后端（FastAPI :8000）
echo ============================================================
echo.

:: 切换到脚本所在目录（前端目录）
cd /d "%~dp0"
set FRONTEND_DIR=%cd%

:: 后端目录（仓库中的代码\dev\apps\backend）
set BACKEND_DIR=%~dp0..\dev\apps\backend

:: —— 1. 检查前端 Node.js ——
echo [1/8] 检查前端 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 22+
    echo    下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js 已安装
echo.

:: —— 2. 检查前端 pnpm ——
echo [2/8] 检查 pnpm 包管理器...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  未检测到 pnpm，正在自动安装...
    npm install -g pnpm@11
    if %errorlevel% neq 0 (
        echo ❌ pnpm 安装失败，请手动执行: npm install -g pnpm@11
        echo.
        pause
        exit /b 1
    )
    echo ✅ pnpm 安装完成
) else (
    echo ✅ pnpm 已安装
)
echo.

:: —— 3. 安装前端依赖 ——
echo [3/8] 检查前端项目依赖...
if not exist "node_modules\" (
    echo 📦 正在安装前端依赖（首次启动可能需要几分钟）...
    pnpm install
) else (
    echo 🔄 检查前端依赖更新...
    pnpm install
)
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    echo.
    pause
    exit /b 1
)
echo ✅ 前端依赖就绪
echo.

:: —— 4. 检查后端 Python ——
echo [4/8] 检查后端 Python 环境...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  未检测到 Python，后端服务将跳过
    echo    如需启动后端，请安装 Python 3.11+
    echo    下载地址: https://www.python.org/downloads/
    set BACKEND_SKIP=1
    goto skip_backend
)
echo ✅ Python 已安装
echo.

:: —— 5. 后端虚拟环境 ——
echo [5/8] 检查后端虚拟环境...
cd /d "%BACKEND_DIR%"
if not exist ".venv\" (
    echo 📦 正在创建 Python 虚拟环境...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo ❌ 虚拟环境创建失败，后端服务将跳过
        set BACKEND_SKIP=1
        goto skip_backend
    )
    echo ✅ 虚拟环境创建完成
) else (
    echo ✅ 虚拟环境已存在
)

:: 激活虚拟环境并安装依赖
call ".venv\Scripts\activate.bat"
echo 📦 检查后端依赖...
pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  后端依赖安装可能有问题，尝试继续启动...
) else (
    echo ✅ 后端依赖就绪
)
echo.

:skip_backend
:: 回到前端目录
cd /d "%FRONTEND_DIR%"

:: —— 6. 批准构建脚本 ——
echo [6/8] 批准依赖构建脚本...
pnpm approve-builds --all >nul 2>&1
echo ✅ 构建脚本已批准
echo.

:: —— 7. 检查环境变量 ——
echo [7/8] 检查环境变量配置...
if not exist ".env.local" (
    echo ⚠️  未找到 .env.local，部分功能可能不可用
) else (
    echo ✅ .env.local 已存在
)
echo.

:: —— 8. 启动服务 ——
echo [8/8] 启动所有服务...
echo.
echo ============================================================
echo    🚀 服务启动中...
echo    🌐 前端地址: http://localhost:3000
if not defined BACKEND_SKIP (
echo    🔧 后端地址: http://localhost:8000
)
echo    ⏹️  关闭此窗口停止所有服务
echo ============================================================
echo.

:: 延迟后自动打开浏览器
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"

:: 启动后端（新窗口）
if not defined BACKEND_SKIP (
    start "深知后端 - FastAPI :8000" cmd /k "cd /d ""%BACKEND_DIR%"" && call ""%BACKEND_DIR%\.venv\Scripts\activate.bat"" && uvicorn app.main:app --reload --port 8000"
)

:: 启动前端（当前窗口阻塞）
pnpm dev

:: 如果启动失败，暂停以便查看错误
if %errorlevel% neq 0 (
    echo.
    echo ❌ 前端服务启动失败，请查看上方错误信息
    echo.
    pause
)
