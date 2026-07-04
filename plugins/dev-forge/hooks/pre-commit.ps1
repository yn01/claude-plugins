# dev-forge pre-commit hook (Windows/PowerShell)
# Warns if there are open gates in .dev-forge/gate/active/ before a git commit.
# Does not block the commit — advisory only.

$ACTIVE_DIR = ".dev-forge\gate\active"

if (-not (Test-Path $ACTIVE_DIR)) {
    exit 0
}

$open_count = 0
Get-ChildItem -Path $ACTIVE_DIR -Filter "*.md" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw 2>$null
    if ($content -match "(?m)^open$") {
        $open_count++
    }
}

if ($open_count -gt 0) {
    Write-Output "⚠️  dev-forge: $open_count open gate(s) found. Run /dev-forge:gate verify to check completion criteria."
}

exit 0
