# BloodBridge - FULL app: backend API (SQLite file database) + website
$root = Split-Path -Parent $PSScriptRoot
$be   = Join-Path $root 'backend'
$fe   = Join-Path $root 'frontend'
$log  = Join-Path $root ('launch\start-full-' + (Get-Date -Format 'HHmmss') + '.log')
"=== start-full $(Get-Date) ===" | Set-Content $log
function Say($m) { $m | Tee-Object -FilePath $log -Append | Out-Host }
function Run($cmd) { cmd /c "$cmd 2>&1" | Tee-Object -FilePath $log -Append | Out-Host; $c = $LASTEXITCODE; Say "EXIT CODE [$cmd]: $c"; return $c }

# ---- Stop any earlier BloodBridge windows/servers ----
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
  $_.ProcessId -ne $PID -and ($_.CommandLine -like '*start-full.ps1*' -or $_.CommandLine -like '*start-demo.ps1*' -or $_.CommandLine -like '*restart-backend.ps1*' -or $_.CommandLine -like '*BloodBridge - Backend API*')
} | ForEach-Object { Say "Stopping earlier window (PID $($_.ProcessId))"; cmd /c "taskkill /PID $($_.ProcessId) /T /F 2>&1" | Out-Null }
foreach ($port in 5000, 5173) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Say "Freeing port $port (PID $($_.OwningProcess))"; cmd /c "taskkill /PID $($_.OwningProcess) /T /F 2>&1" | Out-Null }
}
Start-Sleep -Seconds 2

# ---- Backend settings ----
Set-Location $be
if (-not (Test-Path '.env')) {
  $secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
@"
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="$secret"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"
# Email is pointed at a dummy local server so no real emails are sent in local testing
SMTP_HOST="localhost"
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER="dev@localhost"
SMTP_PASS="dev"
SMTP_FROM="dev@localhost"
SMTP_FROM_NAME="BloodBridge (local)"
EMAIL_OTP_TTL_SECONDS=300
EMAIL_OTP_MAX_ATTEMPTS=5
EMAIL_OTP_RESEND_COOLDOWN_SECONDS=60
PASSWORD_RESET_TTL_SECONDS=900
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:5000/api/v1/auth/google/callback"
FRONTEND_URL="http://localhost:5173"
"@ | Set-Content -Encoding ascii '.env'
  Say "Created backend\.env"
}

# npm workspaces: one install at the repo root covers backend + frontend
Write-Host "== Installing / checking packages for backend + website ==" -ForegroundColor Cyan
Push-Location $root; Run "npm install --no-audit --no-fund" | Out-Null; Pop-Location

Write-Host "== Preparing database ==" -ForegroundColor Cyan
Run "npx prisma generate" | Out-Null
Run "npx prisma db push --skip-generate" | Out-Null
# Re-run the seed whenever the sample data version changes
$seedVersion = 'india-v1'
$seedFile = Join-Path $be 'prisma\.seeded'
if (-not (Test-Path $seedFile) -or ((Get-Content $seedFile -Raw).Trim() -ne $seedVersion)) {
  $c = Run "npm run prisma:seed"
  if ($c -eq 0) { $seedVersion | Set-Content $seedFile }
}

Write-Host "== Starting backend API in a new window (port 5000) ==" -ForegroundColor Cyan
$beLog = Join-Path $root ('launch\backend-run-' + (Get-Date -Format 'HHmmss') + '.log')
Start-Process powershell -ArgumentList '-NoProfile','-NoExit','-Command', "`$host.UI.RawUI.WindowTitle='BloodBridge - Backend API'; Set-Location '$be'; cmd /c 'npm run dev 2>&1' | Tee-Object -FilePath '$beLog'"

$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 2
  try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:5000/health'; if ($r.StatusCode -eq 200) { $ok = $true; break } } catch {}
}
Say "BACKEND HEALTH OK: $ok"

# ---- Website, switched to live API mode ----
Set-Location $fe
@"
VITE_APP_MODE=api
VITE_API_BASE_URL=/api/v1
"@ | Set-Content -Encoding ascii '.env'
Say "frontend\.env set to api mode"
Write-Host "== Starting website at http://localhost:5173 ==" -ForegroundColor Green
Write-Host "Keep BOTH windows open. Close them to stop the app."
Say "STARTING VITE"
cmd /c "npx vite --open 2>&1" | Tee-Object -FilePath $log -Append
