# One-time repair of old referral links (see backend\scripts\fix-referral-links.ts)
$root = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $root ('launch\fix-referral-links-' + (Get-Date -Format 'HHmmss') + '.log')
Set-Location (Join-Path $root 'backend')
"=== fix-referral-links $(Get-Date) ===" | Set-Content $log
cmd /c "npx tsx scripts/fix-referral-links.ts 2>&1" | Tee-Object -FilePath $log -Append | Out-Host
"Done. Results saved to $log" | Out-Host
