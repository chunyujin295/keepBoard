@echo off
setlocal
cd /d "%~dp0.."
title keepBoard Installer Builder

echo ============================================
echo   keepBoard - Build Windows Installer
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install it from https://nodejs.org
    exit /b 1
)

if not exist node_modules (
    echo [1/3] Installing dependencies...
    call npm install
    if errorlevel 1 exit /b 1
) else (
    echo [1/3] Dependencies OK.
)

echo [2/3] Generating pixel icons + building...
call npm run prepackage
if errorlevel 1 exit /b 1

echo [3/3] Packaging with electron-builder ...
call npm run package
if errorlevel 1 exit /b 1

echo.
echo ============================================
echo   Done! Output files:
echo --------------------------------------------
for %%f in (release\*.exe) do echo   %%f
echo ============================================
echo   - Setup .exe     : NSIS installer
echo   - Portable .exe  : single-file, no install
pause
