# dev-forge pre-tool-use hook (Windows/PowerShell)

$DB = ".dev-forge\dev-forge.db"
$ToolInput = $env:CLAUDE_TOOL_INPUT

if (-not (Test-Path $DB) -or -not $ToolInput) { exit 0 }

if ($ToolInput -notmatch "INSERT INTO messages") { exit 0 }

# Extract agents from SQL
$from = if ($ToolInput -match "from_agent\s*[',`"]\s*'?([^',`"]+)") { $Matches[1] } else { "" }
$to = if ($ToolInput -match "to_agent\s*[',`"]\s*'?([^',`"]+)") { $Matches[1] } else { "" }

if (-not $from -or -not $to) { exit 0 }

$allowed = sqlite3.exe $DB "SELECT COALESCE(allowed, 0) FROM communication_rules WHERE from_agent='$from' AND to_agent='$to'" 2>$null

if ($allowed -ne "1") {
    $snippet = $ToolInput.Substring(0, [Math]::Min(200, $ToolInput.Length))
    sqlite3.exe $DB "INSERT INTO violation_log (from_agent, to_agent, message_content, attempted_at) VALUES ('$from', '$to', '$($snippet -replace "'", "")', datetime('now'))" 2>$null
    Write-Output "COMMUNICATION VIOLATION: '$from' is not authorized to contact '$to'."
    Write-Output "Message blocked and logged to violation_log."
    exit 1
}
