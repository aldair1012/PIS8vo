param([string]$Destino = "$env:LOCALAPPDATA\ZeaSys\Respaldos", [string]$Hora = '20:00', [string]$MysqlDefaults)
$ErrorActionPreference = 'Stop'
$python = (Get-Command python -CommandType Application | Select-Object -First 1).Source
$script = Join-Path $PSScriptRoot 'respaldo_base.py'
$argumentos = '"{0}" "{1}" --probar-restauracion' -f $script, [IO.Path]::GetFullPath($Destino)
if ($MysqlDefaults) { $argumentos += ' --mysql-defaults "{0}"' -f (Resolve-Path -LiteralPath $MysqlDefaults).Path }
$accion = New-ScheduledTaskAction -Execute $python -Argument $argumentos
$diario = New-ScheduledTaskTrigger -Daily -At $Hora
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'ZeaSys - Respaldo de MariaDB' -Action $accion -Trigger $diario -Settings $ajustes -Description 'Respaldo y verificación en una base temporal. Se ejecuta en la sesión del titular.'
