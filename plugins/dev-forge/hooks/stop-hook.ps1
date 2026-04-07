# dev-forge stop-hook (Windows/PowerShell)

$DB = ".dev-forge\dev-forge.db"

if (-not (Test-Path $DB) -or $env:EXIT_SIGNAL) {
    exit 0
}

$active = (sqlite3.exe $DB "SELECT COUNT(*) FROM contracts WHERE status='active'" 2>$null)
if ([int]($active -replace '\D', '0') -gt 0) {
    Write-Output "⚠️  dev-forge: $active active contract(s) in progress."
    Write-Output "   Run /dev-forge:stop to gracefully shut down, or set EXIT_SIGNAL=true to force exit."
}
