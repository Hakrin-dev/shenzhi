@echo off
setlocal
set PG=%LOCALAPPDATA%\shenzhi-postgresql
set BIN=%PG%\pgsql\bin
set DATA=%PG%\data
set LOG=%PG%\logfile.txt

if not exist "%BIN%\pg_ctl.exe" (
  echo PostgreSQL binaries not found at %BIN%
  exit /b 1
)

"%BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if %ERRORLEVEL%==0 (
  echo PostgreSQL already running on 127.0.0.1:5432
  exit /b 0
)

"%BIN%\pg_ctl.exe" -D "%DATA%" -l "%LOG%" -o "-p 5432" start
"%BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432
endlocal
