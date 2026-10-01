@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ===================================================
echo [Free Games Claimer] Диагностика запуска браузера
echo ===================================================
echo.

node test-browser.js

echo.
pause
