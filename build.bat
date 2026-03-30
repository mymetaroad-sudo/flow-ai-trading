@echo off
chcp 65001 > nul

echo.
echo ========================================
echo   Roadflow AI Lite V1 - Build
echo ========================================
echo.

:: Node.js check
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found.
    echo   Install from: https://nodejs.org
    pause
    exit /b 1
)

:: Python check
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found.
    echo   Install from: https://python.org
    pause
    exit /b 1
)

:: Kill any running Python/uvicorn that may lock roadflow.db
echo Stopping any running backend processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM uvicorn.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Remove locked DB files from previous build output
echo Cleaning previous build...
if exist "dist-electron\win-unpacked\resources\backend\roadflow.db" (
    del /F /Q "dist-electron\win-unpacked\resources\backend\roadflow.db" >nul 2>&1
)
if exist "backend\roadflow.db" (
    del /F /Q "backend\roadflow.db" >nul 2>&1
)

echo [1/5] Python Embedded check...
if not exist "python-embedded\python.exe" (
    echo   Running download script...
    PowerShell -ExecutionPolicy Bypass -File "%~dp0scripts\download-python.ps1"
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Python Embedded install failed.
        pause
        exit /b 1
    )
) else (
    echo   OK - already exists.
)

echo.
echo [2/5] Installing root npm packages...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo [3/5] Installing frontend packages...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] frontend npm install failed.
    cd ..
    pause
    exit /b 1
)

echo.
echo [4/5] Building frontend (Vite)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [5/5] Building Electron installer...
:: Use --win only (skip build:frontend since we already built above)
call node_modules\.bin\electron-builder --win
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Electron build failed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD COMPLETE!
echo   Output folder: dist-electron
echo ========================================
echo.
explorer dist-electron
pause
