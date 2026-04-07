# dev-forge session-start hook (Windows/PowerShell)
# Counts unread messages in the SQLite database and notifies the user.

$DB = ".dev-forge\dev-forge.db"

if (-not (Test-Path $DB)) {
    exit 0
}

$count = (sqlite3.exe $DB "SELECT COUNT(*) FROM messages WHERE status='unread'" 2>$null)
if ([int]($count -replace '\D', '0') -gt 0) {
    Write-Output "📬 dev-forge: You have $count unread message(s). Run /dev-forge:status to review."
}
