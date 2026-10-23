@echo off
setlocal EnableExtensions
set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

call :puerto_activo 11434
if not errorlevel 1 (
    echo [ZeaSys] Ollama ya esta activo en http://127.0.0.1:11434
    exit /b 0
)

if not exist "%OLLAMA_EXE%" (
    for /f "delims=" %%I in ('where ollama 2^>nul') do if not defined OLLAMA_EXE_PATH set "OLLAMA_EXE_PATH=%%I"
    if defined OLLAMA_EXE_PATH set "OLLAMA_EXE=%OLLAMA_EXE_PATH%"
)

if not exist "%OLLAMA_EXE%" (
    echo [ZeaSys] ERROR: no se encontro Ollama.
    echo [ZeaSys] Instala Ollama o agrega ollama.exe al PATH.
    exit /b 1
)

echo [ZeaSys] Iniciando Ollama en http://127.0.0.1:11434 ...
start "ZeaSys Ollama" /B "%OLLAMA_EXE%" serve
exit /b 0

:puerto_activo
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; if (Get-NetTCPConnection -LocalPort %~1 -State Listen) { exit 0 } else { exit 1 }"
exit /b %errorlevel%
