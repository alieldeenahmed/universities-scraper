# Makes the tool start by itself when you log in to Windows.
# Run once from a normal (non admin) PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1
#
# Undo with uninstall-autostart.ps1.

$ErrorActionPreference = "Stop"

$taskName = "UniversitiesScraper"
$script = Join-Path $PSScriptRoot "start-server.ps1"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Starts the universities scraper backend and UI at logon" `
    -Force | Out-Null

Write-Host "Installed scheduled task '$taskName'. It will start at your next logon."
Write-Host "To start it now without logging out: Start-ScheduledTask -TaskName $taskName"
Write-Host "Log file: $(Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'backend\logs\server.log')"
