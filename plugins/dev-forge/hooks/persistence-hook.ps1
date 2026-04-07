# dev-forge persistence hook (Windows/PowerShell)

$output = $env:CLAUDE_TOOL_OUTPUT

$abandonPatterns = "cannot continue|I'll stop|unable to proceed|I give up|too complex to|I am unable|I cannot complete"

if ($output -match $abandonPatterns) {
    Write-Output "🔄 dev-forge persistence: Task abandonment language detected."
    Write-Output "   Please break the task into smaller steps and continue with the next step."
}
