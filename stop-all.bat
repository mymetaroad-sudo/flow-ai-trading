@echo off
chcp 65001 > nul
echo Stopping all Flow AI Trading processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "')  do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "')  do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5174 "')  do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":19200 "') do taskkill /F /PID %%a >nul 2>&1
echo Done.
timeout /t 2 /nobreak > nul
