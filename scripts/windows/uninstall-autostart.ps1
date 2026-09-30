# Removes the scheduled task made by install-autostart.ps1. Data is not touched.

$taskName = "UniversitiesScraper"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed scheduled task '$taskName'."
} else {
    Write-Host "No scheduled task called '$taskName'."
}
