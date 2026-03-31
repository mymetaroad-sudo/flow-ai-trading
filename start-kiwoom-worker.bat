@echo off
chcp 65001 > nul
echo === Flow AI Trading - Kiwoom Worker ===
echo.

set PYTHON32=C:\Python39_32\python.exe
set QT_QPA_PLATFORM_PLUGIN_PATH=C:\Python39_32\Lib\site-packages\PyQt5\Qt5\plugins\platforms

if not exist "%PYTHON32%" (
    echo [ERROR] 32bit Python not found: %PYTHON32%
    pause
    exit /b 1
)

echo Starting Kiwoom Worker on port 19200...
echo Kiwoom login popup will appear after clicking connect button.
echo.
"%PYTHON32%" "%~dp0backend\kiwoom_worker.py"
pause
