@echo off
REM =========================================================
REM ZeaSys IA - Autoinicio del Servidor -
REM =========================================================

cd /d "%~dp0ml-engine"

REM Comprobar si el puerto 5000 ya está en uso
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [ZeaSys] Servidor IA ya activo en puerto 5000
    exit /b 0
)

echo [ZeaSys] Iniciando servidor IA en segundo plano...

REM Intentar con python
where python >nul 2>&1
if %errorlevel%==0 (
    start "" /B python app.py > flask_server.log 2>&1
    exit /b 0
)

where py >nul 2>&1
if %errorlevel%==0 (
    start "" /B py app.py > flask_server.log 2>&1
    exit /b 0
)

echo [ZeaSys] ERROR: Python no encontrado en PATH
exit /b 1
