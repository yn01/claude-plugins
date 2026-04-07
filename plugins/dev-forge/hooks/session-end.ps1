# dev-forge session-end hook (Windows/PowerShell)

$DB = ".dev-forge\dev-forge.db"

if (-not (Test-Path $DB)) {
    exit 0
}

sqlite3.exe $DB "UPDATE agent_status SET status='stopped', last_active=datetime('now')" 2>$null

$SessionId = Get-Date -Format "yyyyMMdd"
$count = (sqlite3.exe $DB "SELECT COUNT(*) FROM learnings WHERE session_id='$SessionId'" 2>$null)
if ([int]($count -replace '\D', '0') -gt 0) {
    Write-Output "📚 dev-forge: $count learning(s) recorded this session. Run /dev-forge:learn review to organize."
}

$WikiDir = ".dev-forge\wiki"
if (Test-Path $WikiDir) {
    $emptyFiles = (Get-ChildItem $WikiDir -Filter "*.md" | Where-Object { $_.Length -eq 0 }).Count
    if ($emptyFiles -gt 0) {
        Write-Output "⚠️  dev-forge wiki: $emptyFiles empty file(s) detected. Run /dev-forge:wiki lint to clean up."
    }
}
