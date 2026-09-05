@echo off
title SUBAYBAY - scan this QR with Expo Go
REM Prints the QR for the running Expo tunnel. Needs `npm run tunnel` going in
REM another window; this one only reads the URL that server publishes.
REM A roomy window keeps the QR from wrapping, which makes it unscannable.
mode con: cols=90 lines=44
cd /d "%~dp0"
node qr.js
echo.
echo Leave this window open while you scan. Press any key to close.
pause >nul
