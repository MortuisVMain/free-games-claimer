@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ===================================================
echo [Free Games Claimer] Режим первого входа (Login)
echo ===================================================
echo Открываем браузер для авторизации в магазинах:
echo - Epic Games Store
echo - GOG.com
echo - Steam
echo - Fab.com (Unreal Engine)
echo - Unity Asset Store
echo.
echo Все сессии навсегда сохраняются локально в папке data\browser.
echo ===================================================
echo.

rem 1. Проверка наличия библиотек (если пользователь забыл запустить Setup.bat)
if not exist "node_modules\" (
    echo [ИНФО] Библиотеки еще не установлены. Автоматически запускаем Setup.bat...
    call Setup.bat
)

rem 2. Снятие возможных блокировок профиля браузера от зависших процессов
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name = 'chrome.exe' or name = 'msedge.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*data*browser*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

rem 3. Запуск с показом окна браузера
call ClaimGames.cmd --show
pause
