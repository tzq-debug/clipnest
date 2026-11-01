@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   ClipNest 调试模式
echo   ----------------------------------------
echo   这个窗口就是程序本体，关掉它 = 退出 ClipNest
echo   改界面代码会自动生效，不用重启
echo.

set CLIPNEST_ELECTRON_ARGS=--no-proxy-server
call npm run dev

echo.
echo   程序已退出。
pause
