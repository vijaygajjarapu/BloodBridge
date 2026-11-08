# BloodBridge - check the code, then commit all changes to a NEW branch and push it (never to main)
# Branch name: first line of launch\push-branch.txt   Commit message: launch\commit-message.txt
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$log = Join-Path $root 'launch\push-changes.log'
"=== push-changes $(Get-Date) ===" | Set-Content $log
function Log($m) { "$m" | Tee-Object -FilePath $log -Append | Out-Host }

$branch = ''
$branchFile = Join-Path $root 'launch\push-branch.txt'
if (Test-Path $branchFile) { $branch = (Get-Content $branchFile -TotalCount 1).Trim() }
$msgFile = Join-Path $root 'launch\commit-message.txt'
if (-not $branch -or $branch -eq 'main' -or $branch -eq 'master') { Log 'STOP: branch name missing, or it is main. Nothing pushed.'; exit 1 }
if (-not (Test-Path $msgFile)) { Log 'STOP: launch\commit-message.txt is missing. Nothing pushed.'; exit 1 }

# 1. Type-check first; stop if anything is broken
$checks = @(@('frontend', 'npx tsc -b --pretty false'), @('backend', 'npx tsc --noEmit --pretty false'))
foreach ($c in $checks) {
  Push-Location (Join-Path $root $c[0])
  $out = cmd /c "$($c[1]) 2>&1"
  $code = $LASTEXITCODE
  Pop-Location
  $out | ForEach-Object { Log $_ }
  Log "CHECK $($c[0]) EXIT CODE: $code"
  if ($code -ne 0) { Log 'STOP: code check failed. Nothing pushed.'; exit 1 }
}

# 1b. Automated tests (fresh test database, your real data is not touched)
Push-Location (Join-Path $root 'backend')
$out = cmd /c "npx vitest run 2>&1"
$code = $LASTEXITCODE
Pop-Location
$out | ForEach-Object { Log $_ }
Log "TESTS EXIT CODE: $code"
if ($code -ne 0) { Log 'STOP: a test failed. Nothing pushed.'; exit 1 }

# 2. New branch with the current changes
git checkout -B $branch 2>&1 | ForEach-Object { Log $_ }
git add -A 2>&1 | ForEach-Object { Log $_ }
$staged = @(git diff --cached --name-only)
$bad = $staged | Where-Object { $_ -match '(^|/)\.env$|\.env\.local$|\.db$|\.db-journal$|^backend/uploads/|delete-users\.txt$|node_modules/|\.seeded$|\.log$' }
if ($bad) { Log 'STOP: refusing to commit these private files:'; $bad | ForEach-Object { Log "  $_" }; git reset -q; exit 1 }
if ($staged.Count -eq 0) { Log 'Nothing new to commit.' }
else {
  $staged | ForEach-Object { Log "  + $_" }
  git commit -F $msgFile 2>&1 | ForEach-Object { Log $_ }
}

# 3. Push the branch (you merge it on GitHub yourself)
git push -u origin $branch 2>&1 | ForEach-Object { Log $_ }
Log "PUSH EXIT CODE: $LASTEXITCODE"
Write-Host "Done. Log saved to $log" -ForegroundColor Green
