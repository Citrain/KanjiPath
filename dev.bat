@echo off
rem Lance le script PowerShell de lancement KanjiPath (contourne l'ExecutionPolicy)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1"
echo.
pause
