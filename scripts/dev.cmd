@echo off
setlocal
cd /d "%~dp0.."
title keepBoard Dev

echo ============================================
echo   keepBoard - Dev Mode (Vite + Electron)
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install it from https://nodejs.org
    exit /b 1
)

if not exist node_modules (
    echo [1/2] Installing dependencies...
    call npm install
    if errorlevel 1 exit /b 1
) else (
    echo [1/2] Dependencies OK.
)

echo [2/2] Starting Vite + Electron ...
call npm run dev
