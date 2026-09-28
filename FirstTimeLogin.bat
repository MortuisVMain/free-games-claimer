@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo [Free Games Claimer] Manual Login Mode
echo Opening visible browser for interactive authentication...
echo Log into your accounts (Epic Games, GOG, Steam, Fab, Unity).
echo Once logged in, sessions are saved permanently to data\browser.
echo ===================================================

call ClaimGames.cmd --show
pause
