@echo off
setlocal EnableExtensions
REM =========================================================
REM ZeaSys IA - Autoinicio del Servidor -
REM =========================================================

REM El lanzador vive en /scripts; siempre resolver el proyecto desde su ubicacion.
set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%\ml-engine"

if not exist "app.py" (
    echo [ZeaSys] ERROR: no se encontro ml-engine\app.py
    exit /b 1
)

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
    start "ZeaSys ML Engine" /B python app.py
    exit /b 0
)

where py >nul 2>&1
if %errorlevel%==0 (
    start "ZeaSys ML Engine" /B py app.py
    exit /b 0
)

echo [ZeaSys] ERROR: Python no encontrado en PATH
exit /b 1
