@echo off
cd /d "%~dp0"
echo.
echo   ClipNest - dev mode
echo   ------------------------------------------
echo   Keep this window open. Closing it quits ClipNest.
echo   UI changes reload automatically.
echo.
set CLIPNEST_ELECTRON_ARGS=--no-proxy-server
call npm run dev
echo.
echo   ClipNest exited.
pause
