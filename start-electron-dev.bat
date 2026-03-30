@echo off
cd C:\roadflow_build
start "Backend" cmd /k "cd backend && C:\Python39_32\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
timeout /t 4 /nobreak > nul
start "Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 6 /nobreak > nul
set ROADFLOW_PYTHON=C:\Python39_32\python.exe
npm run electron:dev
