$taskName = 'FreeGamesClaimerStudio'
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "[Free Games Claimer] Remove Windows Scheduler Task" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow

try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Host "[SUCCESS] Task '$taskName' removed from Windows Task Scheduler.`n" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Task was not found or already removed.`n" -ForegroundColor Yellow
}