@echo on
cd /d %~dp0

echo ==========================================
echo Starting Safe Deploy for SHG App
echo ==========================================

echo.
echo [1/3] Building project...
call npm run build
if errorlevel 1 (
  echo ❌ Build failed. Deployment stopped.
  pause
  exit /b 1
)

echo.
echo [2/3] Deploying to Firebase...
call firebase deploy --only hosting
if errorlevel 1 (
  echo ❌ Firebase deploy failed.
  pause
  exit /b 1
)

echo.
echo [3/3] Deployment successful!
echo ==========================================
echo ✅ App deployed successfully.
echo ==========================================

pause