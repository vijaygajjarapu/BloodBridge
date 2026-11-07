# BloodBridge - type-check the website and backend code (does not change anything)
$root = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $root ('launch\check-code-' + (Get-Date -Format 'HHmmss') + '.log')
"=== check-code $(Get-Date) ===" | Set-Content $log
function Run($dir, $cmd) {
  Push-Location $dir
  "---- [$dir] $cmd" | Tee-Object -FilePath $log -Append | Out-Host
  cmd /c "$cmd 2>&1" | Tee-Object -FilePath $log -Append | Out-Host
  "EXIT CODE: $LASTEXITCODE" | Tee-Object -FilePath $log -Append | Out-Host
  Pop-Location
}
Run (Join-Path $root 'frontend') 'npx tsc -b --pretty false'
Run (Join-Path $root 'backend') 'npx tsc --noEmit --pretty false'
Write-Host "Done. Results saved to $log" -ForegroundColor Green
