@echo off
REM SUBAYBAY liaison app — start the dev server for a phone on the same Wi-Fi.
REM Scan the QR that appears with Expo Go (Android) or the Camera app (iOS).
cd /d "%~dp0"
npx expo start --lan --port 8081
