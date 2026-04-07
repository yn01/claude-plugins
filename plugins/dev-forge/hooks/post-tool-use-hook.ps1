# dev-forge post-tool-use hook (Windows/PowerShell)

$DB = ".dev-forge\dev-forge.db"
$ToolOutput = $env:CLAUDE_TOOL_OUTPUT

if (-not $ToolOutput -or -not (Test-Path $DB)) { exit 0 }

$completionPatterns = "EVALUATION PASS|contract completed|iteration complete|all criteria met|PASS:"

if ($ToolOutput -match $completionPatterns) {
    $iteration = (sqlite3.exe $DB "SELECT COALESCE(MAX(iteration), 0) + 1 FROM learnings" 2>$null)
    Write-Output "💡 dev-forge: Iteration $iteration appears complete."
    Write-Output "   Consider recording learnings: /dev-forge:learn record --iteration $iteration"
}
