# Roadflow AI Lite V1 - Python Embedded 다운로드
# 실행: PowerShell에서 .\scripts\download-python.ps1

$ErrorActionPreference = "Stop"
$PythonVersion = "3.11.9"
$PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$GetPipUrl = "https://bootstrap.pypa.io/get-pip.py"
$OutDir = Join-Path $PSScriptRoot "..\python-embedded"
$OutDir = [System.IO.Path]::GetFullPath($OutDir)

Write-Host "=== Python Embedded 설치 ===" -ForegroundColor Cyan
Write-Host "설치 경로: $OutDir"

# 기존 폴더 정리
if (Test-Path $OutDir) {
    Remove-Item $OutDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutDir | Out-Null

# Python Embedded ZIP 다운로드
Write-Host "Python $PythonVersion 다운로드 중..." -ForegroundColor Yellow
$ZipPath = Join-Path $OutDir "python-embed.zip"
Invoke-WebRequest -Uri $PythonUrl -OutFile $ZipPath -UseBasicParsing
Write-Host "압축 해제 중..."
Expand-Archive -Path $ZipPath -DestinationPath $OutDir -Force
Remove-Item $ZipPath

# ._pth 파일 찾기 (python311._pth 등)
Write-Host "pip 활성화 중..."
$pthFiles = Get-ChildItem -Path $OutDir -Filter "*._pth"
if ($pthFiles.Count -eq 0) {
    Write-Host "._pth 파일을 찾지 못했습니다. 폴더 내용:" -ForegroundColor Red
    Get-ChildItem $OutDir | ForEach-Object { Write-Host "  $_" }
    throw "._pth 파일 없음"
}

$pthFile = $pthFiles[0]
Write-Host "  _pth 파일: $($pthFile.Name)"

# import site 주석 해제 (pip 사용을 위해 필요)
$content = Get-Content -Path $pthFile.FullName -Raw
$content = $content -replace "#import site", "import site"
Set-Content -Path $pthFile.FullName -Value $content -NoNewline

# get-pip 다운로드 및 설치
Write-Host "pip 설치 중..." -ForegroundColor Yellow
$getPipPath = Join-Path $OutDir "get-pip.py"
Invoke-WebRequest -Uri $GetPipUrl -OutFile $getPipPath -UseBasicParsing
$pythonExe = Join-Path $OutDir "python.exe"
& $pythonExe $getPipPath --no-warn-script-location
Remove-Item $getPipPath

# requirements.txt 경로
$reqPath = Join-Path $PSScriptRoot "..\backend\requirements.txt"
$reqPath = [System.IO.Path]::GetFullPath($reqPath)

if (Test-Path $reqPath) {
    Write-Host "패키지 설치 중 (requirements.txt)..." -ForegroundColor Yellow
    & $pythonExe -m pip install -r $reqPath --no-warn-script-location
} else {
    Write-Host "requirements.txt 없음 — 기본 패키지만 설치" -ForegroundColor Yellow
    & $pythonExe -m pip install fastapi uvicorn sqlmodel pydantic pydantic-settings --no-warn-script-location
}

Write-Host ""
Write-Host "완료! python-embedded 폴더가 준비되었습니다." -ForegroundColor Green
Write-Host "이제 build.bat 를 실행하세요."
