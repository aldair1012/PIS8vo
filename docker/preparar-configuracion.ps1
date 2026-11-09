$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $configPath) {
    Write-Host 'La configuración local ya existe; se conserva sin cambios.'
    exit 0
}
function New-Secret {
    $bytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
$content = "ZEASYS_DEMO_DB_PASSWORD=$(New-Secret)`nZEASYS_DEMO_ROOT_PASSWORD=$(New-Secret)`n"
try {
    $stream = [System.IO.File]::Open($configPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
        $writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
        try { $writer.Write($content) } finally { $writer.Dispose() }
    } finally { $stream.Dispose() }
} catch [System.IO.IOException] {
    throw 'No se pudo crear la configuración nueva. No se sobrescribió ningún archivo existente.'
}
Write-Host 'Configuración de demostración creada. Mantén el archivo .env privado.'
