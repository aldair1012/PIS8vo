param([switch]$Asistente)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker todavía no está disponible en la terminal.' }
& (Join-Path $PSScriptRoot 'preparar-configuracion.ps1')
$argsCompose = @('compose', '--env-file', (Join-Path $PSScriptRoot '.env'), '-f', (Join-Path $PSScriptRoot 'compose.yaml'))
if ($Asistente) { $argsCompose += @('--profile', 'assistant') }
$argsCompose += @('up', '-d', '--build')
& docker @argsCompose
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar la demostración. Consulta los mensajes de Docker.' }
Write-Host 'Servicios iniciados. Abre http://localhost:8087/ZeaSys/'
if ($Asistente) { Write-Host 'El asistente requiere configurar los flujos, la credencial y el índice documental por separado.' }
