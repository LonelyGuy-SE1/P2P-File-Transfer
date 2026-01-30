@echo off
cd /d "%~dp0"
echo ===================================================
echo   Secure P2P File Transfer System
echo   Starting Server...
echo ===================================================
echo.
python server.py
pause
