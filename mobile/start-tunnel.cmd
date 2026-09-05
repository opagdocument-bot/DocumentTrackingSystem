@echo off
title SUBAYBAY liaison app - Expo tunnel
REM Runs the dev server through Expo's tunnel, so a phone can connect from any
REM network - no Wi-Fi match and no Windows Firewall rule needed.
REM Scan the QR below with Expo Go. Press Ctrl+C to stop.
cd /d "%~dp0"
npx expo start --tunnel
echo.
echo The server has stopped. Press any key to close this window.
pause >nul
