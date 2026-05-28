# dev-guide session-start hook (Windows/PowerShell)
# If .dev-guide/index.md exists, prints its contents and instructs the agent
# to use /dev-guide:query or /dev-guide:inject for deeper context.

$INDEX = ".dev-guide\index.md"

if (-not (Test-Path $INDEX)) {
    exit 0
}

Write-Output "=== dev-guide: Knowledge Base Available ==="
Write-Output ""
Get-Content $INDEX
Write-Output ""
Write-Output "Use /dev-guide:query <question> to retrieve relevant pages."
Write-Output "Use /dev-guide:inject <topic>   to load a specific topic into context."
