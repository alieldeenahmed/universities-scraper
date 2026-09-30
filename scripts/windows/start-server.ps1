# Starts the backend (which also serves the built frontend) and restarts it if it dies.
# The scheduled task created by install-autostart.ps1 runs this at logon.

$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backend = Join-Path $repo "backend"
$logDir = Join-Path $backend "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "server.log"

Set-Location $backend

while ($true) {
    $started = Get-Date
    "[$started] starting server" | Out-File -FilePath $log -Append -Encoding utf8

    & npm run start *>> $log

    $ranFor = (Get-Date) - $started
    "[$(Get-Date)] server exited after $([int]$ranFor.TotalSeconds)s" | Out-File -FilePath $log -Append -Encoding utf8

    # if it dies right away something is broken, don't spin
    $wait = if ($ranFor.TotalSeconds -lt 30) { 60 } else { 10 }
    Start-Sleep -Seconds $wait
}
