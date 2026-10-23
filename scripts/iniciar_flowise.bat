@echo off
setlocal EnableExtensions
set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"
set "FLOWISE_HOME=%LOCALAPPDATA%\ZeaSys-Flowise-Local"
set "HOST=127.0.0.1"
set "PORT=3000"
set "APP_URL=http://127.0.0.1:3000"
set "FLOWISE_FILE_SIZE_LIMIT=150mb"
set "DATABASE_TYPE=sqlite"
set "DATABASE_PATH=%FLOWISE_HOME%\data"
set "SECRETKEY_PATH=%FLOWISE_HOME%\secrets"
set "STORAGE_TYPE=local"
set "BLOB_STORAGE_PATH=%FLOWISE_HOME%\storage"
set "LOG_PATH=%FLOWISE_HOME%\logs"
set "LOG_LEVEL=info"
set "DEBUG=false"
set "LOG_SANITIZE_BODY_FIELDS=password,question,credentialData"
set "LOG_SANITIZE_HEADER_FIELDS=authorization,cookie,set-cookie"
set "DISABLE_FLOWISE_TELEMETRY=true"
set "SHOW_COMMUNITY_NODES=false"
rem Los agentes ReAct heredados son incompatibles con la version actual de LangChain
rem y no forman parte del flujo ZeaSys; no deben registrarse en el pool de nodos.
set "DISABLED_NODES=reactAgentChat,reactAgentLLM"
set "HTTP_SECURITY_CHECK=true"
set "PATH_TRAVERSAL_SAFETY=true"
set "CUSTOM_MCP_SECURITY_CHECK=true"
set "OAUTH2_SECURITY_CHECK=true"
set "CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000"
set "IFRAME_ORIGINS='self'"

set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not exist "%NODE_EXE%" (
  echo No se encontro Node.js en "%NODE_EXE%".
  echo Instala Node.js LTS o ajusta NODE_EXE en este archivo.
  exit /b 1
)

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [ZeaSys] Flowise ya esta activo en http://%HOST%:%PORT%
  exit /b 0
)

if not exist "%FLOWISE_HOME%\node_modules\flowise\bin\run" (
  echo Flowise no esta instalado. Espera a que termine npm install y vuelve a intentar.
  exit /b 1
)

if not exist "%FLOWISE_HOME%\data" mkdir "%FLOWISE_HOME%\data"
if not exist "%FLOWISE_HOME%\secrets" mkdir "%FLOWISE_HOME%\secrets"
if not exist "%FLOWISE_HOME%\storage" mkdir "%FLOWISE_HOME%\storage"
if not exist "%FLOWISE_HOME%\logs" mkdir "%FLOWISE_HOME%\logs"

"%NODE_EXE%" -e "require(process.argv[1])" "%FLOWISE_HOME%\node_modules\sqlite3" >nul 2>&1
if errorlevel 1 (
  echo Flowise no puede cargar sqlite3 para esta version de Node.
  echo Ejecuta en %%FLOWISE_HOME%%: npm rebuild sqlite3 --foreground-scripts
  exit /b 1
)

echo [ZeaSys] Iniciando Flowise en http://%HOST%:%PORT% ...
"%NODE_EXE%" "%FLOWISE_HOME%\node_modules\flowise\bin\run" start
