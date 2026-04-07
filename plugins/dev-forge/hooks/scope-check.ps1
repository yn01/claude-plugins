# dev-forge scope-check hook (Windows/PowerShell)

$TargetFile = $env:CLAUDE_TOOL_INPUT_PATH

if (-not $TargetFile) { exit 0 }

if ($TargetFile -match "\.dev-forge.dev-forge\.db") {
    Write-Output "BLOCKED: Direct modification of .dev-forge\dev-forge.db is not allowed."
    Write-Output "         Use sqlite3.exe commands instead."
    exit 1
}

$ProjectRoot = (Get-Location).Path
# Resolve path without requiring the file to exist
if ([System.IO.Path]::IsPathRooted($TargetFile)) {
    $RealTarget = $TargetFile
} else {
    $RealTarget = [System.IO.Path]::Combine($ProjectRoot, $TargetFile)
}

if (-not $RealTarget.StartsWith($ProjectRoot)) {
    Write-Output "BLOCKED: $TargetFile is outside the project root ($ProjectRoot)."
    exit 1
}
