# dev-forge session-start hook (Windows/PowerShell)
# If .dev-forge/guide/index.md exists, injects its contents and instructs the
# agent to use /dev-forge:guide query or inject for deeper context.

$INDEX = ".dev-forge\guide\index.md"

if (-not (Test-Path $INDEX)) {
    exit 0
}

Write-Output "=== dev-forge: Guide Knowledge Base Available ==="
Write-Output ""
Get-Content $INDEX
Write-Output ""
Write-Output "Use /dev-forge:guide query <question> to retrieve relevant pages."
Write-Output "Use /dev-forge:guide inject <topic>   to load a specific topic into context."
