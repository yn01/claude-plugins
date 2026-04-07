# dev-forge pre-compact hook (Windows/PowerShell)

$DB = ".dev-forge\dev-forge.db"
$Agent = $env:DEV_FORGE_AGENT_NAME
$Task = $env:DEV_FORGE_CURRENT_TASK

if (-not (Test-Path $DB) -or -not $Agent) { exit 0 }

sqlite3.exe $DB "UPDATE agent_status SET last_active=datetime('now'), current_task='$Task' WHERE agent_name='$Agent'" 2>$null

Write-Output "dev-forge: State persisted for agent '$Agent' before context compaction."
