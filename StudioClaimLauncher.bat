@echo off
setlocal
cd /d "%~dp0"
set "FGC_NOPAUSE=1"

echo ===================================================
echo [StudioClaimLauncher] Starting scheduled claim run: %DATE% %TIME%
echo ===================================================

call ClaimGames.cmd --headless --nopause --log

echo [StudioClaimLauncher] Finished run with exit code: %ERRORLEVEL%
exit /b %ERRORLEVEL%
