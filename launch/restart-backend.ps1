# BloodBridge - stop and restart only the backend API
$root = Split-Path -Parent $PSScriptRoot
$be   = Join-Path $root 'backend'
$log  = Join-Path $root 'launch\restart-backend.log'
"=== restart-backend $(Get-Date) ===" | Set-Content $log
function Say($m) { $m | Tee-Object -FilePath $log -Append | Out-Host }

# Stop the old backend window and everything it started
Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'BloodBridge - Backend API*' } | ForEach-Object {
  Say "Stopping old backend window (PID $($_.Id))"; cmd /c "taskkill /PID $($_.Id) /T /F 2>&1" | Out-Null }
Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  Say "Freeing port 5000 (PID $($_.OwningProcess))"; cmd /c "taskkill /PID $($_.OwningProcess) /T /F 2>&1" | Out-Null }
Start-Sleep -Seconds 2

Set-Location $be
cmd /c "npx prisma generate 2>&1" | Tee-Object -FilePath $log -Append | Out-Host
Say "EXIT CODE [prisma generate]: $LASTEXITCODE"

$beLog = Join-Path $root 'launch\backend-run.log'
Start-Process powershell -ArgumentList '-NoProfile','-NoExit','-Command', "`$host.UI.RawUI.WindowTitle='BloodBridge - Backend API'; Set-Location '$be'; cmd /c 'npm run dev 2>&1' | Tee-Object -FilePath '$beLog'"
$ok = $false
for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 2
  try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:5000/health').StatusCode -eq 200) { $ok = $true; break } } catch {} }
Say "BACKEND HEALTH OK: $ok"
if ($ok) { Write-Host "Backend is running. You can close this window." -ForegroundColor Green }
