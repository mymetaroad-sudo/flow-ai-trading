@echo off
chcp 65001 > nul
title Flow AI Trading

set PYTHON32=C:\Python39_32\python.exe
set ROOT=C:\roadflow_build
set VENV=C:\roadflow_build\backend\.venv\Scripts\python.exe
set QT=C:\Python39_32\Lib\site-packages\PyQt5\Qt5\plugins\platforms

if not exist "%PYTHON32%" ( echo [ERROR] 32bit Python not found && pause && exit /b 1 )
if not exist "%VENV%" ( echo [ERROR] venv not found && pause && exit /b 1 )

echo [1/5] Clearing ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5174 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":19200 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak > nul
echo    Done.

echo [2/5] Starting Kiwoom Worker...
start "Flow AI - Kiwoom Worker" cmd /k "set QT_QPA_PLATFORM_PLUGIN_PATH=%QT% & C: & cd %ROOT%\backend & %PYTHON32% kiwoom_worker.py"
timeout /t 3 /nobreak > nul

echo [3/5] Starting Backend...
start "Flow AI - Backend" cmd /k "C: & cd %ROOT%\backend & %VENV% -m uvicorn app.main:app --port 8000"
timeout /t 4 /nobreak > nul

echo [4/5] Starting Frontend...
start "Flow AI - Frontend" cmd /k "C: & cd %ROOT%\frontend & npm run dev"
timeout /t 5 /nobreak > nul

echo [5/5] Starting Electron...
C:
cd %ROOT%
npm run electron:dev

pause
