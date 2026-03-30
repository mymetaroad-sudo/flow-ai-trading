@echo off
chcp 65001 > nul
echo === Roadflow AI Lite V1 - 개발 모드 ===
echo.

:: 백엔드 가상환경 체크 및 설정
if not exist "backend\.venv" (
    echo 가상환경 생성 중...
    cd backend
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
    cd ..
)

echo 백엔드 시작 (포트 8000)...
start "Roadflow Backend" cmd /k "cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

echo 3초 대기...
timeout /t 3 /nobreak > nul

echo 프론트엔드 시작 (포트 5173)...
start "Roadflow Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo 3초 대기...
timeout /t 3 /nobreak > nul

echo 브라우저 열기...
start http://localhost:5173

echo.
echo 개발 서버가 시작되었습니다.
echo   백엔드: http://localhost:8000
echo   프론트: http://localhost:5173
echo   API문서: http://localhost:8000/docs
echo.
pause
