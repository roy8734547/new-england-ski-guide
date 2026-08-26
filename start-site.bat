@echo off
setlocal

rem  start-site.bat - double-click this to run the guide locally.
rem
rem  It checks its prerequisites first and says which one is missing in plain
rem  words, rather than letting npm or node print a stack trace at somebody who
rem  double-clicked a file. Then it starts the dev server in THIS window, waits
rem  for the port to actually accept a connection, and opens your browser.
rem
rem  The waiting is done by tools/wait-for-server.mjs rather than by "timeout /t 3".
rem  A fixed sleep is wrong in both directions - too short on a cold start and the
rem  browser lands on a connection error, too long on a warm one.

cd /d "%~dp0"

title New England Ski Guide - local server

echo.
echo   New England Ski Guide
echo   =====================
echo.

rem --- Node ------------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not installed, or it is not on your PATH.
  echo.
  echo   This site is plain HTML and JavaScript with no build step, but it still
  echo   needs a tiny local web server to run - browsers refuse to load a page's
  echo   data files straight off the disk.
  echo.
  echo   Install the LTS build from https://nodejs.org/ ^(version 20 or newer^),
  echo   then close this window and run start-site.bat again.
  echo.
  goto :halt
)

rem --- npm -------------------------------------------------------------------
where npm >nul 2>nul
if errorlevel 1 (
  echo   Node.js is installed but npm is not on your PATH.
  echo.
  echo   Reinstalling Node.js from https://nodejs.org/ and leaving every option
  echo   at its default will fix this - npm ships with it.
  echo.
  goto :halt
)

rem --- dependencies ----------------------------------------------------------
if not exist "node_modules\" (
  echo   The dependencies are not installed yet.
  echo.
  echo   Open a terminal in this folder and run:
  echo.
  echo       npm ci
  echo.
  echo   That only has to be done once. Then run start-site.bat again.
  echo.
  goto :halt
)

rem --- the site itself -------------------------------------------------------
if not exist "index.html" (
  echo   index.html is not in this folder, so this is not the site's directory.
  echo.
  echo   start-site.bat has to sit in the same folder as index.html. If you
  echo   copied it somewhere, move it back.
  echo.
  goto :halt
)

echo   Starting the local server on http://localhost:8137/
echo.
echo   ------------------------------------------------------------------
echo    KEEP THIS WINDOW OPEN. Closing it stops the server and the site
echo    will stop loading. Press Ctrl+C, or just close the window, when
echo    you are finished.
echo   ------------------------------------------------------------------
echo.

rem  The browser-opener runs in the background so the server can hold the
rem  foreground. /b keeps it attached to this console, so closing the window
rem  takes it with us instead of leaving a stray process behind.
start /b "" node "tools\wait-for-server.mjs" "http://localhost:8137/" --open

rem  Foreground, deliberately: this is what keeps the window alive and what makes
rem  closing the window stop the server.
call npm run dev

echo.
echo   The server has stopped.
echo.

:halt
echo   Press any key to close this window.
pause >nul
endlocal
