# Deletes the accounts listed in launch\delete-users.txt so their email / mobile number can be reused
$root = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $root ('launch\delete-users-' + (Get-Date -Format 'HHmmss') + '.log')
Set-Location (Join-Path $root 'backend')
"=== delete-users $(Get-Date) ===" | Set-Content $log
cmd /c "npx tsx scripts/delete-users.ts 2>&1" | Tee-Object -FilePath $log -Append | Out-Host
"Done. Results saved to $log" | Out-Host
