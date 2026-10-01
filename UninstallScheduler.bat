@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0UninstallScheduler.ps1"
echo.
pause
