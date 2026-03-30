@echo off
chcp 65001 > nul
echo === Roadflow AI Lite V1 - Electron 개발 모드 ===

:: 백엔드 시작
start "Backend" cmd /k "cd backend && .venv\Scripts\activate && uvicorn app.main:app --port 8000"
timeout /t 3 /nobreak > nul

:: 프론트엔드 시작
start "Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 5 /nobreak > nul

:: Electron 시작
npm run electron:dev
