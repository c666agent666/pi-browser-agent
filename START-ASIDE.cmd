@echo off
title pi-browser-agent - Aside launcher
color 0A
echo.
echo   ==============================================
echo     pi-browser-agent  -  launching Aside
echo   ==============================================
echo.
echo   [1/2] pi agent server...
curl -s -m 2 http://127.0.0.1:3848/api/health >nul 2>&1
if errorlevel 1 (
    echo         not running - starting it in a new window...
    start "pi-agent-server" cmd /k "cd /d C:\Users\i\pi-browser-agent && bun packages/pi-agent-server/src/index.ts"
    echo         waiting for server...
    timeout /t 5 /nobreak >nul
) else (
    echo         already running.
)
echo.
echo   [2/2] restarting Aside with browser control...
taskkill /IM aside-daemon.exe /F >nul 2>&1
taskkill /IM Aside.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul
start "" "C:\Program Files\Aside\Application\Aside.exe" --remote-debugging-port=9222
echo         Aside launched.
echo.
echo   Done. Open the side panel: click the green ^>_ toolbar icon.
echo   Status bar should show:  WS:OK   CDP:ONLINE
echo.
echo   This window closes in 10 seconds...
timeout /t 10 >nul