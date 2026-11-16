param([Parameter(Mandatory=$true)][string]$NodeExe, [Parameter(Mandatory=$true)][string]$FlowiseHome)
$ErrorActionPreference = 'Stop'
$flowMutex = New-Object System.Threading.Mutex($false, 'Local\ZeaSysFlowiseRuntime3000')
$flowAcquired = $false
try {
    try { $flowAcquired = $flowMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $flowAcquired = $true }
    if (-not $flowAcquired) { Write-Output 'Flowise ya se está iniciando o está activo. Espera a que termine el arranque.'; exit 0 }
    & $NodeExe (Join-Path $FlowiseHome 'node_modules/flowise/bin/run') start
    $flowExit = $LASTEXITCODE
} finally {
    if ($flowAcquired) { $flowMutex.ReleaseMutex() }
    $flowMutex.Dispose()
}
exit $flowExit
