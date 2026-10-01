@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0InstallScheduler.ps1"
echo.
pause
