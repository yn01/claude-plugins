# dev-forge scope-check hook (Windows/PowerShell)

$TargetFile = $env:CLAUDE_TOOL_INPUT_PATH

if (-not $TargetFile) { exit 0 }

if ($TargetFile -match "\.dev-forge.dev-forge\.db") {
    Write-Output "BLOCKED: Direct modification of .dev-forge\dev-forge.db is not allowed."
    Write-Output "         Use sqlite3.exe commands instead."
    exit 1
}

$ProjectRoot = Get-Location
$RealTarget = Resolve-Path $TargetFile -ErrorAction SilentlyContinue

if ($RealTarget -and -not $RealTarget.Path.StartsWith($ProjectRoot.Path)) {
    Write-Output "BLOCKED: $TargetFile is outside the project root ($ProjectRoot)."
    exit 1
}
