@echo off
chcp 65001 > nul
title Flow AI Trading - Startup

echo.
echo ========================================
echo   Flow AI Trading - Starting...
echo ========================================
echo.

if not exist "C:\Python39_32\python.exe" (
    echo [ERROR] 32bit Python not found
    pause
    exit /b 1
)

echo [1/5] Clearing ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5174 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak > nul
echo    Done.

echo [2/5] Checking venv...
if not exist "C:\roadflow_build\backend\.venv" (
    echo    Creating 32bit venv...
    C:\Python39_32\python.exe -m venv C:\roadflow_build\backend\.venv
    call C:\roadflow_build\backend\.venv\Scripts\activate
    pip install -r C:\roadflow_build\backend\requirements.txt
) else (
    echo    venv OK.
)

echo [3/5] Checking .env...
if not exist "C:\roadflow_build\backend\.env" (
    echo BROKER_MODE=mock> C:\roadflow_build\backend\.env
    echo DAILY_LOSS_LIMIT_PCT=3.0>> C:\roadflow_build\backend\.env
    echo CONSECUTIVE_STOP_LIMIT=5>> C:\roadflow_build\backend\.env
    echo TOTAL_CAPITAL=200000000>> C:\roadflow_build\backend\.env
    echo    .env created.
) else (
    echo    .env OK.
)

echo [4/5] Starting Backend...
start "Flow AI - Backend" cmd /k "C: && cd C:\roadflow_build\backend && .venv\Scripts\activate && C:\Python39_32\python.exe -m uvicorn app.main:app --port 8000"
timeout /t 4 /nobreak > nul
echo    http://localhost:8000

echo [5/5] Starting Frontend...
start "Flow AI - Frontend" cmd /k "C: && cd C:\roadflow_build\frontend && npm run dev"
timeout /t 5 /nobreak > nul
echo    http://localhost:5173

echo.
echo ========================================
echo   Starting Electron...
echo ========================================
echo.

C:
cd C:\roadflow_build
npm run electron:dev

pause