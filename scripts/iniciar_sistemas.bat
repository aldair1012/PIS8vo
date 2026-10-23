@echo off
setlocal EnableExtensions
title ZeaSys - Inicio de servicios

set "SCRIPTS_DIR=%~dp0"
for %%I in ("%SCRIPTS_DIR%") do set "SCRIPTS_DIR=%%~fI"

echo =========================================================
echo  ZeaSys - Inicio unificado de servicios
echo =========================================================
echo.

call :iniciar_xampp
call :iniciar_si_falta 11434 "%SCRIPTS_DIR%iniciar_ollama.bat" "Ollama"
call :iniciar_si_falta 8000 "%SCRIPTS_DIR%iniciar_chroma.bat" "Chroma"
call :iniciar_si_falta 5000 "%SCRIPTS_DIR%auto_ia_server.bat" "Motor IA"
call :iniciar_si_falta 3000 "%SCRIPTS_DIR%iniciar_flowise.bat" "Flowise"

echo.
echo [ZeaSys] Esperando disponibilidad de los servicios iniciados...
call :esperar_puerto 80 "Apache" 15
call :esperar_puerto 3306 "MySQL" 15
call :esperar_puerto 5000 "Motor IA" 15
call :esperar_puerto 8000 "Chroma" 15
call :esperar_puerto 11434 "Ollama" 15
call :esperar_puerto 3000 "Flowise" 20

echo.
echo [ZeaSys] Comprobando servicios...
call :mostrar_estado 80 "Apache"
call :mostrar_estado 3306 "MySQL"
call :mostrar_estado 5000 "Motor IA"
call :mostrar_estado 8000 "Chroma"
call :mostrar_estado 11434 "Ollama"
call :mostrar_estado 3000 "Flowise"
echo.
echo [ZeaSys] Frontend: http://localhost/ZeaSys/
echo [ZeaSys] Flowise:  http://127.0.0.1:3000
echo [ZeaSys] Este proceso no inicia Vite: Apache sirve el build estable del frontend.
echo.
exit /b 0

:iniciar_xampp
call :puerto_activo 80
set "HTTP_OK=%errorlevel%"
call :puerto_activo 3306
set "MYSQL_OK=%errorlevel%"
if "%HTTP_OK%"=="0" if "%MYSQL_OK%"=="0" (
    echo [ZeaSys] Apache y MySQL ya estan activos.
    exit /b 0
)

if exist "C:\xampp\xampp_start.exe" (
    echo [ZeaSys] Iniciando Apache y MySQL mediante XAMPP...
    start "ZeaSys XAMPP" /B "C:\xampp\xampp_start.exe"
    exit /b 0
)

echo [ZeaSys] XAMPP no tiene xampp_start.exe; intentando iniciar servicios individualmente...
if not "%HTTP_OK%"=="0" if exist "C:\xampp\apache\bin\httpd.exe" start "ZeaSys Apache" /B "C:\xampp\apache\bin\httpd.exe" -d "C:/xampp/apache"
if not "%MYSQL_OK%"=="0" if exist "C:\xampp\mysql\bin\mysqld.exe" start "ZeaSys MySQL" /B "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
exit /b 0

:iniciar_si_falta
call :puerto_activo %~1
if not errorlevel 1 (
    echo [ZeaSys] %~3 ya esta activo en el puerto %~1.
    exit /b 0
)
echo [ZeaSys] Iniciando %~3...
start "%~3" /B "%ComSpec%" /d /c call "%~2"
exit /b 0

:mostrar_estado
call :puerto_activo %~1
if not errorlevel 1 (echo [OK] %~2 - puerto %~1) else (echo [--] %~2 - puerto %~1 no responde)
exit /b 0

:esperar_puerto
for /l %%N in (1,1,%~3) do (
    call :puerto_activo %~1
    if not errorlevel 1 (
        echo [OK] %~2 disponible en el puerto %~1.
        exit /b 0
    )
    timeout /t 1 /nobreak >nul
)
echo [AVISO] %~2 aun no responde en el puerto %~1; revisa sus logs.
exit /b 1

:puerto_activo
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; if (Get-NetTCPConnection -LocalPort %~1 -State Listen) { exit 0 } else { exit 1 }"
exit /b %errorlevel%
