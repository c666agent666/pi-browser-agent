@echo off
title pi-browser-agent - Chrome launcher
color 0A
echo.
echo   ==============================================
echo     pi-browser-agent  -  launching Chrome
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
echo   [2/2] launching Chrome with browser control...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
echo         Chrome launched.
echo.
echo   Done. Open the side panel: click the green ^>_ toolbar icon.
echo   Status bar should show:  WS:OK   CDP:ONLINE
echo.
echo   This window closes in 10 seconds...
timeout /t 10 >nul