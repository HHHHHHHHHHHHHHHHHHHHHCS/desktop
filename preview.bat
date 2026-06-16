@echo off
setlocal

cd /d "%~dp0"

where yarn >nul 2>&1
if errorlevel 1 (
  echo [ERROR] yarn not found in PATH.
  echo Please install Yarn and reopen the terminal.
  exit /b 1
)

echo [1/2] Building development app...
call yarn build:dev
if errorlevel 1 (
  echo [ERROR] yarn build:dev failed.
  pause
  exit /b 1
)

echo [2/2] Starting development preview...
call yarn start
if errorlevel 1 (
  echo [ERROR] yarn start failed.
  pause
  exit /b 1
)

exit /b 0
