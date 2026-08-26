@echo off
setlocal

rem  create-shortcut.bat - puts a "New England Ski Guide" shortcut on the Desktop
rem  that runs start-site.bat, using the site's own favicon as its icon.
rem
rem  Run this once. It is safe to run again; it overwrites the shortcut in place.
rem
rem  The shortcut is built through WScript.Shell from PowerShell, which is the
rem  only way to write a .lnk without shipping a binary. Note that favicon.ico is
rem  BMP-encoded rather than PNG-encoded precisely so Explorer will render it here
rem  - see the note at the top of tools/build-icons.mjs.

cd /d "%~dp0"

echo.
echo   Creating a Desktop shortcut...
echo.

if not exist "start-site.bat" (
  echo   start-site.bat is not in this folder, so there is nothing to point at.
  echo   create-shortcut.bat has to sit next to it.
  echo.
  goto :done
)

if not exist "favicon.ico" (
  echo   favicon.ico is missing. The shortcut will still work but will get the
  echo   generic batch-file icon. Run "npm run build:icons" to regenerate it.
  echo.
)

where powershell >nul 2>nul
if errorlevel 1 (
  echo   PowerShell is not on your PATH, so the shortcut cannot be created
  echo   automatically.
  echo.
  echo   To do it by hand: right-click start-site.bat, Send to ^> Desktop
  echo   ^(create shortcut^).
  echo.
  goto :done
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "try {" ^
  "  $root = (Get-Location).Path;" ^
  "  $link = Join-Path ([Environment]::GetFolderPath('Desktop')) 'New England Ski Guide.lnk';" ^
  "  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($link);" ^
  "  $s.TargetPath = Join-Path $root 'start-site.bat';" ^
  "  $s.WorkingDirectory = $root;" ^
  "  $s.Description = 'Run the New England Ski Guide locally';" ^
  "  $ico = Join-Path $root 'favicon.ico';" ^
  "  if (Test-Path $ico) { $s.IconLocation = \"$ico,0\" }" ^
  "  $s.Save();" ^
  "  Write-Host ('   Created: ' + $link);" ^
  "} catch {" ^
  "  Write-Host '   Could not create the shortcut:';" ^
  "  Write-Host ('   ' + $_.Exception.Message);" ^
  "  exit 1" ^
  "}"

if errorlevel 1 (
  echo.
  echo   To do it by hand instead: right-click start-site.bat, Send to ^>
  echo   Desktop ^(create shortcut^).
) else (
  echo.
  echo   Double-click it on the Desktop to start the site.
)

:done
echo.
echo   Press any key to close this window.
pause >nul
endlocal
