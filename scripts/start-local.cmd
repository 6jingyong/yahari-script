@echo off
setlocal
pushd "%~dp0.." || goto failed

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 22.6 or newer is required. Download it from https://nodejs.org/
  goto failed
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||major===22&&minor>=6?0:1)"
if errorlevel 1 (
  echo Node.js 22.6 or newer is required. Download it from https://nodejs.org/
  goto failed
)

if not exist "node_modules\typescript\bin\tsc" (
  echo Installing dependencies for the first launch...
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto failed
)

echo Building Yahari Script...
call npm run build
if errorlevel 1 goto failed

set "PORT=4173"
echo Starting Yahari Script. Close this window to stop the local server.
node scripts\serve.mjs --open
if errorlevel 1 goto failed
popd
exit /b %errorlevel%

:failed
echo Startup failed. See the message above.
pause
exit /b 1
