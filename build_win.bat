@echo off
setlocal

cd /d "%~dp0"

where yarn >nul 2>&1
if errorlevel 1 (
  echo [ERROR] yarn not found in PATH.
  echo Please install Yarn and reopen the terminal.
  pause
  exit /b 1
)

echo [1/2] Building production bundles...
call yarn build:prod
if errorlevel 1 (
  echo [ERROR] yarn build:prod failed.
  pause
  exit /b 1
)

echo [2/2] Packaging Windows installer...
call yarn package
if errorlevel 1 (
  echo [ERROR] yarn package failed.
  pause
  exit /b 1
)

echo [DONE] Build and package completed.
echo Output folder: dist
pause
exit /b 0
