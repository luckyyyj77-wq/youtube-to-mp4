# 백엔드(uvicorn) + Cloudflare Tunnel을 함께 실행하는 스크립트
# 실행: run.bat 더블클릭 (내부에서 이 스크립트를 호출)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$venvActivate = Join-Path $backendDir ".venv\Scripts\Activate.ps1"

Write-Host "=== 1/3 백엔드 준비 ===" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
    Write-Host "[setup] 가상환경 생성 중..." -ForegroundColor Yellow
    Push-Location $backendDir
    python -m venv .venv
    & $venvActivate
    pip install -r requirements.txt
    Pop-Location
}

# 이미 8000번 포트를 쓰는 프로세스가 있으면 정리
$existing = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[cleanup] 기존 백엔드 프로세스를 종료합니다 (PID: $($existing.OwningProcess))" -ForegroundColor Yellow
    Stop-Process -Id $existing.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "[run] 백엔드를 새 창에서 실행합니다 (http://localhost:8000)" -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$backendDir'; & '$venvActivate'; uvicorn main:app --host 0.0.0.0 --port 8000"
)

Write-Host "[wait] 백엔드가 뜰 때까지 대기 중..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -UseBasicParsing -TimeoutSec 2
        if ($res.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host "[error] 백엔드가 30초 내에 응답하지 않았습니다. 새로 열린 창의 에러 메시지를 확인하세요." -ForegroundColor Red
    Read-Host "엔터를 누르면 종료합니다"
    exit 1
}

Write-Host "[ok] 백엔드 정상 작동 확인" -ForegroundColor Green
Write-Host ""
Write-Host "=== 2/3 Cloudflare Tunnel 시작 ===" -ForegroundColor Cyan

$cloudflaredCandidates = @(
    "C:\Program Files (x86)\cloudflared\cloudflared.exe",
    "C:\Program Files\cloudflared\cloudflared.exe"
)
$cloudflared = $cloudflaredCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $cloudflared) {
    Write-Host "[error] cloudflared.exe를 찾을 수 없습니다. 'winget install --id Cloudflare.cloudflared'로 설치해주세요." -ForegroundColor Red
    Read-Host "엔터를 누르면 종료합니다"
    exit 1
}

$logFile = Join-Path $env:TEMP "cloudflared_tunnel.log"
if (Test-Path $logFile) { Remove-Item $logFile -Force }

$tunnelProcess = Start-Process -FilePath $cloudflared `
    -ArgumentList "tunnel", "--url", "http://localhost:8000" `
    -RedirectStandardError $logFile `
    -PassThru -WindowStyle Hidden

Write-Host "[wait] 터널 주소를 발급받는 중..." -ForegroundColor Yellow
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($content -match "(https://[a-zA-Z0-9\-]+\.trycloudflare\.com)") {
            $tunnelUrl = $matches[1]
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "[error] 터널 주소를 받아오지 못했습니다. $logFile 파일을 확인하세요." -ForegroundColor Red
    Read-Host "엔터를 누르면 종료합니다"
    exit 1
}

Write-Host ""
Write-Host "=== 3/3 준비 완료 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  새 백엔드 주소:  $tunnelUrl" -ForegroundColor Black -BackgroundColor Yellow
Write-Host ""

$configPath = Join-Path $root "frontend\config.js"
$currentConfig = Get-Content $configPath -Raw -ErrorAction SilentlyContinue
$currentUrlMatch = [regex]::Match($currentConfig, 'https://[a-zA-Z0-9\-\.]+')
$currentUrl = if ($currentUrlMatch.Success) { $currentUrlMatch.Value } else { "" }

if ($currentUrl -eq $tunnelUrl) {
    Write-Host "[info] frontend/config.js가 이미 이 주소를 사용 중입니다. 수정할 필요 없습니다." -ForegroundColor Green
} else {
    Write-Host "[action] frontend/config.js의 주소를 새 터널 주소로 자동 업데이트합니다..." -ForegroundColor Yellow
    $newConfig = "const API_BASE_URL = `"$tunnelUrl`";`n"
    Set-Content -Path $configPath -Value $newConfig -NoNewline
    Write-Host "[ok] config.js 업데이트 완료." -ForegroundColor Green
    Write-Host ""
    Write-Host "  이제 아래 명령으로 GitHub에 반영(push)해야 웹앱이 새 주소를 사용합니다:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    git add frontend/config.js" -ForegroundColor White
    Write-Host "    git commit -m `"update backend tunnel url`"" -ForegroundColor White
    Write-Host "    git push" -ForegroundColor White
    Write-Host ""
}

Write-Host "이 창을 닫으면 터널이 종료됩니다. 사용을 마칠 때까지 그대로 두세요." -ForegroundColor Magenta
Write-Host ""

try {
    Wait-Process -Id $tunnelProcess.Id
} finally {
    Write-Host "터널이 종료되었습니다." -ForegroundColor Yellow
}
