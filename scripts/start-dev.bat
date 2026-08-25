@echo off
chcp 65001 >nul
title 深知 ShenZhi · AI 研究助手 - 开发服务器

:: ============================================================
::  深知 ShenZhi · AI 研究助手 B 模块 - 一键启动脚本
::  双击即可运行，自动完成环境检查、依赖安装、启动服务
:: ============================================================

echo.
echo ============================================================
echo    深知 ShenZhi · AI 研究助手 B 模块
echo ============================================================
echo.

:: 切换到脚本所在目录
cd /d "%~dp0"

:: —— 1. 检查 Node.js ——
echo [1/6] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 22+
    echo    下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=2 delims=v." %%a in ('node -v') do set major=%%a
if %major% LSS 22 (
    echo ⚠️  Node.js 版本过低，建议升级到 22+
) else (
    echo ✅ Node.js 已安装
)
echo.

:: —— 2. 检查 pnpm ——
echo [2/6] 检查 pnpm 包管理器...
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

:: —— 3. 安装依赖 ——
echo [3/6] 检查项目依赖...
if not exist "node_modules\" (
    echo 📦 正在安装依赖（首次启动可能需要几分钟）...
    pnpm install
) else (
    echo 🔄 检查依赖更新...
    pnpm install
)
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败，请检查网络连接
    echo.
    pause
    exit /b 1
)
echo ✅ 依赖安装完成
echo.

:: —— 4. 批准构建脚本（pnpm 供应链安全） ——
echo [4/6] 批准依赖构建脚本...
pnpm approve-builds --all >nul 2>&1
echo ✅ 构建脚本已批准
echo.

:: —— 5. 初始化环境变量配置 ——
echo [5/6] 检查环境变量配置...
if not exist ".env.local" (
    if exist ".env.example" (
        echo 📄 首次启动，正在从 .env.example 复制配置模板...
        copy ".env.example" ".env.local" >nul
        echo ✅ 已创建 .env.local
        echo.
        echo ⚠️  重要提示：
        echo    请编辑 .env.local 文件，填入你的 API 密钥：
        echo    - DEEPSEEK_API_KEY  （DeepSeek API 密钥）
        echo    - TAVILY_API_KEY    （Tavily 搜索密钥，可选）
        echo.
        echo    配置完成后重新运行本脚本。
        echo.
        echo 是否现在打开 .env.local 进行编辑？
        choice /c YN /m "请选择"
        if errorlevel 2 goto skip_edit
        if errorlevel 1 (
            notepad ".env.local"
            echo.
            echo 配置完成后，重新运行本脚本启动服务。
            echo.
            pause
            exit /b 0
        )
        :skip_edit
    ) else (
        echo ⚠️  未找到 .env.example，请手动创建 .env.local
    )
) else (
    echo ✅ .env.local 已存在
)
echo.

:: —— 6. 启动开发服务器 ——
echo [6/6] 启动开发服务器...
echo.
echo ============================================================
echo    🚀 服务启动中，请稍候...
echo    🌐 访问地址: http://localhost:3000
echo    ⏹️  按 Ctrl+C 停止服务
echo ============================================================
echo.

:: 延迟几秒后自动打开浏览器
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

:: 启动开发服务器
pnpm dev

:: 如果启动失败，暂停以便查看错误
if %errorlevel% neq 0 (
    echo.
    echo ❌ 服务启动失败，请查看上方错误信息
    echo.
    pause
)
