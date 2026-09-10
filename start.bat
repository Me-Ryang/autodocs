@echo off
chcp 65001 > nul
title AI 스마트 견적서 서버

set "PATH=C:\Program Files\nodejs;%PATH%"

echo ===================================================
echo   AI 스마트 견적서 서버를 시작합니다.
echo   브라우저에서 http://localhost:3000 으로 자동 접속됩니다.
echo ===================================================

start http://localhost:3000

where node >nul 2>nul
if %errorlevel% equ 0 (
    node server.js
) else if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" server.js
) else (
    echo [오류] Node.js를 찾을 수 없습니다. Node.js를 설치해 주세요.
    pause
)
