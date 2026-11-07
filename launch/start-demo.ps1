# BloodBridge - start the website in DEMO mode (no database needed)
$root = Split-Path -Parent $PSScriptRoot
$fe   = Join-Path $root 'frontend'
$log  = Join-Path $root 'launch\start-demo.log'
"=== start-demo $(Get-Date) ===" | Set-Content $log
function Run($cmd) { cmd /c "$cmd 2>&1" | Tee-Object -FilePath $log -Append; "EXIT CODE [$cmd]: $LASTEXITCODE" | Tee-Object -FilePath $log -Append; return $LASTEXITCODE }

Write-Host "== Checking tools ==" -ForegroundColor Cyan
Run "node -v" | Out-Null
Run "npm -v"  | Out-Null

Set-Location $fe
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env'; "Created frontend\.env (demo mode)" | Tee-Object -FilePath $log -Append }

if (-not (Test-Path 'node_modules')) {
  Write-Host "== Installing website packages (first time takes a few minutes) ==" -ForegroundColor Cyan
  $code = Run "npm ci --no-audit --no-fund"
  if ($code -ne 0) { Write-Host "npm ci failed, trying npm install..." -ForegroundColor Yellow; Run "npm install --no-audit --no-fund" | Out-Null }
} else { "Packages already installed." | Tee-Object -FilePath $log -Append }

Write-Host "== Starting website at http://localhost:5173 ==" -ForegroundColor Green
Write-Host "Keep this window open. Close it to stop the website."
"STARTING VITE" | Add-Content $log
cmd /c "npx vite --open 2>&1" | Tee-Object -FilePath $log -Append
