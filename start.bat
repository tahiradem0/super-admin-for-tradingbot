@echo off
TITLE Super Admin Panel - Launcher
CLS

ECHO ========================================================
ECHO   SUPER ADMIN PANEL - LAUNCHER
ECHO   Trading Bot Management System
ECHO ========================================================
ECHO.

:: Check for Node.js
node --version 1>nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [ERROR] Node.js is not installed or not in PATH.
    ECHO.
    ECHO Please install Node.js from https://nodejs.org/
    ECHO.
    PAUSE
    EXIT /B
)

ECHO [OK] Node.js found.
ECHO.

:: Start both server and client in separate windows
ECHO [1/2] Starting Backend Server on port 5001...
start "Super Admin - Backend" cmd /k "cd server && npm start"

ECHO [2/2] Starting Frontend on port 5173...
timeout /t 3 /nobreak >nul
start "Super Admin - Frontend" cmd /k "cd client && npm run dev"

ECHO.
ECHO ========================================================
ECHO   SUPER ADMIN PANEL STARTED!
ECHO.
ECHO   Backend API:  http://localhost:5001
ECHO   Frontend UI:  http://localhost:5173
ECHO.
ECHO   Login Credentials (from .env):
ECHO   Email:    superadmin@trading.com
ECHO   Password: SuperAdmin123!
ECHO ========================================================
ECHO.
ECHO Press any key to exit this launcher (servers will keep running)...
PAUSE >nul
