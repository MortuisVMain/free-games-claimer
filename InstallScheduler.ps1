$taskName = 'FreeGamesClaimerStudio'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $scriptDir 'StudioClaimLauncher.bat'

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "[Free Games Claimer] Windows Scheduler Setup" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Schedule: Tuesday, Friday, Sunday at 13:30 (silent background)"
Write-Host "Target script: $scriptPath`n"

$action = New-ScheduledTaskAction -Execute $scriptPath
$days = @('Tuesday', 'Friday', 'Sunday')
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At 13:30
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Write-Host "[SUCCESS] Task '$taskName' successfully registered in Windows Task Scheduler!" -ForegroundColor Green
    $info = (Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo)
    Write-Host "Next scheduled run: $($info.NextRunTime)`n" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Failed to register task: $($_.Exception.Message)" -ForegroundColor Red
}