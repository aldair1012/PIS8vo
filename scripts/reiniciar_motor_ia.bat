@echo off
setlocal EnableExtensions
title ZeaSys - Reinicio del motor IA

set "SCRIPTS_DIR=%~dp0"
REM Detener únicamente el proceso que escucha el puerto del motor Flask.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue; if ($listener) { try { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop; Start-Sleep -Milliseconds 500; if (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) { exit 3 }; Write-Host ('[ZeaSys] Motor IA detenido (PID ' + $listener.OwningProcess + ').') } catch { Write-Host ('[ZeaSys] No se pudo detener el motor IA: ' + $_.Exception.Message); exit 2 } }"
if errorlevel 1 goto :stop_failed
timeout /t 1 /nobreak >nul

call "%SCRIPTS_DIR%auto_ia_server.bat"
if errorlevel 1 goto :start_failed
echo [ZeaSys] Motor IA reiniciado con los modelos actuales.
endlocal
exit /b 0

:stop_failed
echo [ZeaSys] No se reinicio el motor: cierra el proceso que posee el puerto 5000 con permisos de administrador y vuelve a ejecutar este archivo.
endlocal
exit /b 1

:start_failed
echo [ZeaSys] No se pudo iniciar el motor IA.
endlocal
exit /b 1
