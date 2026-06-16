@echo off
setlocal

cd /d "%~dp0"

set "APP_EXE=dist\GitHubDesktop-win32-x64\GitHubDesktop.exe"

if not exist "%APP_EXE%" (
  echo [ERROR] Executable not found:
  echo %APP_EXE%
  echo Please run build_win.bat first.
  exit /b 1
)

start "" "%APP_EXE%"
exit /b 0
