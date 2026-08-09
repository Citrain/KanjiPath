@echo off
rem Lance le script PowerShell de lancement KanjiPath (contourne l'ExecutionPolicy)
rem Exemple vocal : dev.bat -Voice -VoicevoxPath "C:\chemin\vers\VOICEVOX.exe"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
echo.
pause
