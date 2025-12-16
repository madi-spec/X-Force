# ============================================
# Setup Windows Task Scheduler for PST Import
# Run this script as Administrator
# ============================================

$TaskName = "X-FORCE PST Import"
$TaskPath = "\X-FORCE\"
$Description = "Daily import of emails and calendar events from PST file at 5:00 AM EST"

# Remove existing task if it exists
Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false -ErrorAction SilentlyContinue

# Create the action
$Action = New-ScheduledTaskAction `
    -Execute "C:\Users\tmort\x-force\scripts\run-pst-import.bat" `
    -WorkingDirectory "C:\Users\tmort\x-force"

# Create the trigger (5:00 AM daily)
$Trigger = New-ScheduledTaskTrigger -Daily -At "5:00AM"

# Create settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -WakeToRun

# Create the principal (run whether user is logged on or not)
$Principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType S4U `
    -RunLevel Limited

# Register the task
Register-ScheduledTask `
    -TaskName $TaskName `
    -TaskPath $TaskPath `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description $Description

Write-Host ""
Write-Host "Task '$TaskName' created successfully!" -ForegroundColor Green
Write-Host "Schedule: Daily at 5:00 AM EST" -ForegroundColor Cyan
Write-Host ""
Write-Host "To verify: Open Task Scheduler > Task Scheduler Library > X-FORCE"
Write-Host "To run manually: Right-click the task > Run"
