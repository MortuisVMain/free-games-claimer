$Host.UI.RawUI.WindowTitle = "Free Games Claimer - Setup"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "[Free Games Claimer] First Time Setup" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

# 1. Check Node.js
$nodeInstalled = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeInstalled = $true
} elseif (Test-Path "$env:ProgramFiles\nodejs\node.exe") {
    $env:PATH = "$env:ProgramFiles\nodejs;$env:APPDATA\npm;" + $env:PATH
    $nodeInstalled = $true
}

if (-not $nodeInstalled) {
    Write-Host "[INFO] Node.js is not installed on this system." -ForegroundColor Yellow
    Write-Host "Starting automatic installation of Node.js LTS...`n" -ForegroundColor Yellow

    $installedSuccessfully = $false

    # Attempt 1: winget (Windows 10/11 built-in)
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[1/2] Installing via Windows Package Manager (winget)..." -ForegroundColor Cyan
        try {
            $wingetProcess = Start-Process winget -ArgumentList "install", "OpenJS.NodeJS.LTS", "--silent", "--accept-source-agreements", "--accept-package-agreements" -Wait -PassThru -NoNewWindow
            if ($wingetProcess.ExitCode -eq 0) {
                $installedSuccessfully = $true
            }
        } catch {}
    }

    # Attempt 2: Direct download of official MSI installer from nodejs.org
    if (-not $installedSuccessfully) {
        Write-Host "[1/2] Downloading official Node.js LTS installer from nodejs.org..." -ForegroundColor Cyan
        $msiUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
        $msiPath = Join-Path $env:TEMP "node-setup.msi"

        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
                & curl.exe -L -o $msiPath $msiUrl
            } else {
                (New-Object System.Net.WebClient).DownloadFile($msiUrl, $msiPath)
            }

            if (Test-Path $msiPath) {
                Write-Host "[2/2] Installing Node.js (please accept Windows UAC administrator prompt if shown)..." -ForegroundColor Cyan
                $msiProcess = Start-Process msiexec.exe -ArgumentList "/i", "`"$msiPath`"", "/passive" -Wait -PassThru
                if ($msiProcess.ExitCode -eq 0) {
                    $installedSuccessfully = $true
                }
                Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Host "[WARN] Failed downloading Node.js MSI: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }

    # Refresh PATH in current session
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:PATH = "$env:ProgramFiles\nodejs;$env:APPDATA\npm;$machinePath;$userPath;" + $env:PATH

    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeInstalled = $true
    } elseif (Test-Path "$env:ProgramFiles\nodejs\node.exe") {
        $nodeInstalled = $true
    }
}

if (-not $nodeInstalled) {
    Write-Host "`n[ERROR] Automatic Node.js installation failed." -ForegroundColor Red
    Write-Host "Please download and install Node.js manually from official site:" -ForegroundColor Red
    Write-Host "https://nodejs.org/en/download/`n" -ForegroundColor Cyan
    Start-Process "https://nodejs.org/en/download/"
    exit 1
}

$nodeVer = & node -v
Write-Host "[1/3] Node.js is ready: $nodeVer`n" -ForegroundColor Green

# 2. Install npm dependencies
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
Set-Location $scriptDir

Write-Host "[2/3] Installing dependencies (npm install)..." -ForegroundColor Cyan
cmd.exe /c "npm install"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install npm dependencies." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host ""

# 3. Install Patchright Chromium browser engine
Write-Host "[3/3] Downloading stealth browser engine (Patchright Chromium)..." -ForegroundColor Cyan
cmd.exe /c "npx patchright install chrome"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Browser download encountered a warning. Continuing..." -ForegroundColor Yellow
}
Write-Host ""

# 4. Create Desktop shortcut with custom icon
Write-Host "Creating desktop shortcut..." -ForegroundColor Cyan
try {
    $wsh = New-Object -ComObject WScript.Shell
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop 'Free Games Claimer.lnk'
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $scriptDir 'ClaimGames.cmd'
    $shortcut.WorkingDirectory = $scriptDir
    $iconPath = Join-Path $scriptDir 'app_icon.ico'
    if (Test-Path $iconPath) {
        $shortcut.IconLocation = $iconPath
    }
    $shortcut.Save()
    Write-Host "[OK] Desktop shortcut created successfully!" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Failed to create shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Setup completed successfully!" -ForegroundColor Green
Write-Host "`nNext Step:" -ForegroundColor Cyan
Write-Host "Launch FirstTimeLogin.bat to sign into your accounts" -ForegroundColor White
Write-Host "(Epic Games, Fab, GOG, Steam, Unity)." -ForegroundColor White
Write-Host "===================================================`n" -ForegroundColor Green
