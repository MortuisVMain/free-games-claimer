@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ClaimGames.cmd - claim free games with optional command line parameters.
rem Run "ClaimGames.cmd --help" for usage.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

rem ---- defaults ----
set "SHOW=0"
set "LOG=0"
set "UPDATE=0"
set "SHOWHELP="
set "PARSE_ERR="
set "CLAIM_SPECIFIED=0"
set "IN_CLAIM=0"
set "KNOWN=0"
set "PLATFORMS="
set "HAS_EPIC="
set "HAS_PRIME="
set "HAS_GOG="
set "HAS_STEAM="
set "FGC_LOG_FILE="
set "FGC_MINIMIZE="

rem ---- parse arguments ----
rem parse here instead of in a called routine: forwarding the raw "/?" via `call :parse %*`
rem would make cmd print its own CALL help instead of reaching our parser
:parse_args
if "%~1"=="" goto :after_parse
set "ARG=%~1"
set "PREFIX=!ARG:~0,1!"
if "!PREFIX!"=="-" goto :parse_flag
if "!PREFIX!"=="/" goto :parse_flag
if "!IN_CLAIM!"=="1" (
    call :addPlatform "%~1"
) else (
    echo [ERROR] Unexpected argument: %~1
    set "PARSE_ERR=1"
)
goto :parse_next

:parse_flag
set "IN_CLAIM=0"
set "KNOWN=0"
call :handleFlag "%~1"
if "!KNOWN!"=="0" (
    echo [ERROR] Unknown option: %~1
    set "PARSE_ERR=1"
)

:parse_next
shift
goto :parse_args

:after_parse
if defined SHOWHELP (
    call :usage
    exit /b 0
)
if defined PARSE_ERR (
    echo.
    call :usage
    exit /b 1
)
if "%CLAIM_SPECIFIED%"=="1" (
    if "%PLATFORMS%"=="" (
        echo [ERROR] --claim requires at least one platform: epic prime gog steam fab unreal unity
        echo.
        call :usage
        exit /b 1
    )
) else (
    rem no --claim given: claim active platforms (epic, gog, steam, fab, unity)
    set "PLATFORMS= epic gog steam fab unity"
)

rem ---- update repository ----
if "%UPDATE%"=="1" (
    echo Pulling updates from Github...
    git pull
    if errorlevel 1 echo [WARN] git pull failed - continuing with the current version.
) else (
    echo Skipping git update [use --u/--update to pull].
)

rem ---- logging ----
if "%LOG%"=="1" call :initLog

rem ---- handling for the node scripts ----
rem the scripts append their full output to the log file themselves
if "%LOG%"=="1" set "FGC_LOG_FILE=%LOGFILE%"
rem stores that cannot run headless open a visible browser: minimize it, unless --show was given
if not "%SHOW%"=="1" set "FGC_MINIMIZE=1"

rem ---- summary ----
echo.
echo === Free Games Claimer ===
if "%SHOW%"=="1" (echo   Browser : shown) else (echo   Browser : headless - forced stores open minimized)
if "%LOG%"=="1" (echo   Log file: %LOGFILE%) else (echo   Log file: disabled - use --l/--log to save output)
if "%UPDATE%"=="1" (echo   Update  : yes) else (echo   Update  : no)
echo   Claiming:%PLATFORMS%
echo.

rem ---- claim ----
for %%P in (%PLATFORMS%) do call :claim "%%P"

echo.
echo Complete
if not "%NOPAUSE%"=="1" if not defined FGC_NOPAUSE pause
exit /b 0


rem ==================== subroutines ====================

:handleFlag
if /i "%~1"=="--nopause"  ( set "NOPAUSE=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--h"        ( set "SHOW=0" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="-h"         ( set "SHOW=0" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--headless" ( set "SHOW=0" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--s"        ( set "SHOW=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="-s"         ( set "SHOW=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--show"     ( set "SHOW=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--l"        ( set "LOG=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="-l"         ( set "LOG=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--log"      ( set "LOG=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--u"        ( set "UPDATE=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="-u"         ( set "UPDATE=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--update"   ( set "UPDATE=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--c"        ( set "IN_CLAIM=1" & set "CLAIM_SPECIFIED=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="-c"         ( set "IN_CLAIM=1" & set "CLAIM_SPECIFIED=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--claim"    ( set "IN_CLAIM=1" & set "CLAIM_SPECIFIED=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="/?"        ( set "SHOWHELP=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="-?"        ( set "SHOWHELP=1" & set "KNOWN=1" & exit /b 0 )
if /i "%~1"=="--help"    ( set "SHOWHELP=1" & set "KNOWN=1" & exit /b 0 )
exit /b 0

:addPlatform
if /i "%~1"=="epic"   goto :add_epic
if /i "%~1"=="prime"  goto :add_prime
if /i "%~1"=="gog"    goto :add_gog
if /i "%~1"=="steam"  goto :add_steam
if /i "%~1"=="unreal" goto :add_unreal
if /i "%~1"=="ue"     goto :add_unreal
if /i "%~1"=="fab"    goto :add_fab
if /i "%~1"=="unity"  goto :add_unity
echo [ERROR] Unknown platform: %~1
echo         Valid platforms: epic prime gog steam fab unreal unity
set "PARSE_ERR=1"
exit /b 0

:add_epic
if not defined HAS_EPIC ( set "HAS_EPIC=1" & set "PLATFORMS=!PLATFORMS! epic" )
exit /b 0
:add_prime
if not defined HAS_PRIME ( set "HAS_PRIME=1" & set "PLATFORMS=!PLATFORMS! prime" )
exit /b 0
:add_gog
if not defined HAS_GOG ( set "HAS_GOG=1" & set "PLATFORMS=!PLATFORMS! gog" )
exit /b 0
:add_steam
if not defined HAS_STEAM ( set "HAS_STEAM=1" & set "PLATFORMS=!PLATFORMS! steam" )
exit /b 0
:add_unreal
if not defined HAS_UNREAL ( set "HAS_UNREAL=1" & set "PLATFORMS=!PLATFORMS! unreal" )
exit /b 0
:add_fab
if not defined HAS_FAB ( set "HAS_FAB=1" & set "PLATFORMS=!PLATFORMS! fab" )
exit /b 0
:add_unity
if not defined HAS_UNITY ( set "HAS_UNITY=1" & set "PLATFORMS=!PLATFORMS! unity" )
exit /b 0

:claim
if /i "%~1"=="epic"   goto :claim_epic
if /i "%~1"=="prime"  goto :claim_prime
if /i "%~1"=="gog"    goto :claim_gog
if /i "%~1"=="steam"  goto :claim_steam
if /i "%~1"=="unreal" goto :claim_unreal
if /i "%~1"=="ue"     goto :claim_unreal
if /i "%~1"=="fab"    goto :claim_fab
if /i "%~1"=="unity"  goto :claim_unity
exit /b 0

:claim_epic
call :runScript "epic-games" "Epic Games"
exit /b 0
:claim_prime
call :runScript "prime-gaming" "Prime Gaming"
exit /b 0
:claim_gog
call :runScript "gog" "GOG"
exit /b 0
:claim_steam
call :runScript "steam" "Steam"
exit /b 0
:claim_unreal
call :runScript "fab" "Fab / Unreal Engine"
exit /b 0
:claim_fab
call :runScript "fab" "Fab / Unreal Engine"
exit /b 0
:claim_unity
call :runScript "unity" "Unity Asset Store"
exit /b 0

:runScript
rem %1 = node script name, %2 = display label
set "NODE_SCRIPT=%~1"
set "LABEL=%~2"
echo.
echo --- Claiming %LABEL% ---
if "%LOG%"=="1" >>"%LOGFILE%" echo --- Claiming %LABEL% ---
node "%NODE_SCRIPT%"
if errorlevel 1 echo [WARN] %LABEL% script exited with an error.
exit /b 0

:initLog
for /f "delims=" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%I"
if not defined STAMP set "STAMP=unknown"
set "LOGFILE=%SCRIPT_DIR%ClaimOutput_%STAMP%.log"
(
    echo.
    echo ============================================================
    echo ClaimGames.cmd - %STAMP%
    if "%SHOW%"=="1" (echo Browser : shown) else (echo Browser : headless - forced stores minimized)
    echo Claiming:%PLATFORMS%
    echo ============================================================
) >>"%LOGFILE%"
exit /b 0

:usage
echo.
echo Usage: ClaimGames.cmd [options]
echo.
echo   Run without options to claim all stores headless.
echo.
echo   --h, -h, --headless  Run without showing the browser [default]
echo   --s, -s, --show      Show the browser while claiming
echo                        Without it, stores that cannot run headless open a
echo                        minimized browser
echo   --c, -c, --claim ... Claim only the given platforms, in the given order
echo                        Valid platforms: epic prime gog steam fab unity
echo                        Example: ClaimGames.cmd --claim epic fab gog
echo                        Default [no --claim]: all platforms
echo   --l, -l, --log       Save all output to ClaimOutput_^<date^>.log
echo   --u, -u, --update    Update the repository via "git pull"
echo   --help, /?           Show this help
echo.
echo Examples:
echo   ClaimGames.cmd
echo   ClaimGames.cmd /?
echo   ClaimGames.cmd --show
echo   ClaimGames.cmd --claim epic prime
echo   ClaimGames.cmd --headless --claim gog steam --log
echo   ClaimGames.cmd --update --log --claim epic gog
echo.
exit /b 0
