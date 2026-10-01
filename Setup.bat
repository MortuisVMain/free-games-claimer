@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ===================================================
echo [Free Games Claimer] Первоначальная настройка
echo ===================================================
echo.

rem 1. Проверка наличия Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] Node.js не найден на компьютере!
    echo Для работы сборщика требуется Node.js (версия 20 или новее).
    echo Сейчас откроется страница загрузки...
    start https://nodejs.org/en/download/
    echo.
    echo Установите Node.js (при установке просто нажимайте Next) и запустите этот файл снова.
    echo.
    pause
    exit /b 1
)

echo [1/3] Node.js обнаружен:
node -v
echo.

rem 2. Установка зависимостей npm
echo [2/3] Установка библиотек (npm install)...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] Не удалось установить зависимости npm.
    pause
    exit /b %ERRORLEVEL%
)
echo.

rem 3. Установка браузера Patchright Chromium
echo [3/3] Загрузка браузера Patchright Chromium...
call npx patchright install chrome
if %ERRORLEVEL% neq 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Ошибка загрузки браузера. Пробуем продолжить...
)
echo.

rem 4. Создание ярлыка на рабочем столе с иконкой
echo Создание ярлыка на Рабочем столе...
powershell -NoProfile -Command ^
  "$w = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$s = $w.CreateShortcut(\"$desktop\Free Games Claimer.lnk\"); " ^
  "$s.TargetPath = '%~dp0ClaimGames.cmd'; " ^
  "$s.WorkingDirectory = '%~dp0'; " ^
  "if (Test-Path '%~dp0app_icon.ico') { $s.IconLocation = '%~dp0app_icon.ico' }; " ^
  "$s.Save(); " ^
  "Write-Host 'Ярлык успешно создан на Рабочем столе!'"

echo.
echo ===================================================
echo [ГОТОВО] Установка успешно завершена!
echo.
echo Следующий шаг:
echo Запустите файл FirstTimeLogin.bat, чтобы один раз
echo войти в свои аккаунты (Epic Games, Fab, GOG, Steam, Unity).
echo ===================================================
echo.
pause
