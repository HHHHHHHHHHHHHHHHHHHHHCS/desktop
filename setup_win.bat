@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] node not found in PATH.
  echo Please install Node.js and reopen the terminal.
  pause
  exit /b 1
)

where yarn >nul 2>&1
if errorlevel 1 (
  echo [ERROR] yarn not found in PATH.
  echo Please install Yarn and reopen the terminal.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] git not found in PATH.
  echo Please install Git and reopen the terminal.
  pause
  exit /b 1
)

echo [Info] Tool versions:
node -v
yarn -v
git --version
echo.

echo [1/2] Syncing submodules...
call git submodule update --init --recursive
if errorlevel 1 (
  echo [ERROR] git submodule update failed.
  pause
  exit /b 1
)

echo [2/2] Installing dependencies...
call yarn install --check-files
if errorlevel 1 (
  echo [ERROR] yarn install failed.
  pause
  exit /b 1
)

echo [DONE] Setup completed.
echo You can now run build_win.bat.
pause
exit /b 0
