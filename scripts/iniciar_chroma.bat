@echo off
setlocal EnableExtensions
set "CHROMA_HOME=%LOCALAPPDATA%\ZeaSys-Chroma"
set "CHROMA_DATA=%CHROMA_HOME%\data"
set "CHROMA_PY=%CHROMA_HOME%\Scripts\python.exe"

call :puerto_activo 8000
if not errorlevel 1 (
    echo [ZeaSys] Chroma ya esta activo en http://127.0.0.1:8000
    exit /b 0
)

if not exist "%CHROMA_DATA%" mkdir "%CHROMA_DATA%"
if not exist "%CHROMA_PY%" (
    for /f "delims=" %%I in ('where python 2^>nul') do if not defined SYSTEM_PY set "SYSTEM_PY=%%I"
    if defined SYSTEM_PY set "CHROMA_PY=%SYSTEM_PY%"
)

if not exist "%CHROMA_PY%" (
    echo [ZeaSys] ERROR: no se encontro Python para iniciar Chroma.
    exit /b 1
)

echo [ZeaSys] Iniciando Chroma en http://127.0.0.1:8000 ...
start "ZeaSys Chroma" /B "%CHROMA_PY%" -m chromadb.cli.cli run --path "%CHROMA_DATA%" --host 127.0.0.1 --port 8000 --log-path "%CHROMA_HOME%\chroma.log"
exit /b 0

:puerto_activo
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; if (Get-NetTCPConnection -LocalPort %~1 -State Listen) { exit 0 } else { exit 1 }"
exit /b %errorlevel%
