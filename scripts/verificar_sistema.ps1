param(
    [string]$PhpPath = 'C:\xampp\php\php.exe',
    [switch]$OmitirBuild,
    [switch]$Integracion,
    [switch]$Navegador,
    [switch]$Recuperacion
)

$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
$pythonPath = (Get-Command python -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $PhpPath -PathType Leaf)) {
    throw 'No se encontro PHP. Indica su ruta con -PhpPath.'
}

function Invoke-ZeaCheck {
    param([string]$Nombre, [string]$Carpeta, [string]$Ejecutable, [string[]]$Argumentos)
    Write-Host "Verificando: $Nombre"
    Push-Location -LiteralPath $Carpeta
    try {
        & $Ejecutable @Argumentos
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo la comprobacion: $Nombre (codigo $LASTEXITCODE)."
        }
    } finally {
        Pop-Location
    }
}

$frontendDir = Join-Path $projectDir 'frontend-app'
Invoke-ZeaCheck 'Frontend / lint' $frontendDir $npmPath @('run', 'lint')
Invoke-ZeaCheck 'Frontend / pruebas' $frontendDir $npmPath @('test')
Invoke-ZeaCheck 'Frontend / tipos del piloto' $frontendDir $npmPath @('run', 'typecheck:pilot')
Invoke-ZeaCheck 'Herramientas / respaldo y búsqueda documental' $projectDir $pythonPath @('-m', 'unittest', 'discover', '-s', 'tools', '-p', 'test_*.py', '-v')
Invoke-ZeaCheck 'Chat / ruta documental y respaldo simulados' $projectDir $pythonPath @('backend-api/tests/chat/recuperacion_integracion.py')
Invoke-ZeaCheck 'Chat / concurrencia y cierre de sesión' $projectDir $pythonPath @('backend-api/tests/chat/sesion_concurrente.py')
if ($Navegador) {
    Invoke-ZeaCheck 'Frontend / navegador' $frontendDir $npmPath @('run', 'test:e2e')
}
foreach ($suite in @('kernel', 'analitica', 'chat', 'validacion', 'simulaciones', 'variedades', 'autenticacion', 'explicacion', 'terreno')) {
    Invoke-ZeaCheck "PHP / $suite" $projectDir $PhpPath @("backend-api/tests/$suite/ejecutar.php")
}
foreach ($suite in @('clima-escenarios', 'finanzas', 'mediciones')) {
    Invoke-ZeaCheck "PHP / $suite" $projectDir $PhpPath @("backend-api/tests/analitica/$suite.php")
}
Invoke-ZeaCheck 'PHP / origen de escrituras' $projectDir $PhpPath @('backend-api/tests/kernel/origen.php')
Invoke-ZeaCheck 'Python / motor y proveedores' (Join-Path $projectDir 'ml-engine') $pythonPath @('-m', 'unittest', 'discover', '-s', 'tests', '-v')
if (-not $OmitirBuild) {
    Invoke-ZeaCheck 'Frontend / build y copia a XAMPP' $frontendDir $npmPath @('run', 'build')
}
if ($Integracion) {
    $previousTestPhp = $env:ZEASYS_TEST_PHP
    $env:ZEASYS_TEST_PHP = $PhpPath
    try {
        Invoke-ZeaCheck 'HTTP / MySQL desechable / modelo real' $projectDir $pythonPath @('backend-api/tests/integracion/ejecutar.py')
    } finally {
        if ($null -eq $previousTestPhp) { Remove-Item Env:ZEASYS_TEST_PHP -ErrorAction SilentlyContinue }
        else { $env:ZEASYS_TEST_PHP = $previousTestPhp }
    }
}
if ($Recuperacion) {
    Invoke-ZeaCheck 'Recuperacion / MariaDB temporal / Chroma aislado' $projectDir $pythonPath @('tools/probar_recuperacion.py')
}
Write-Host 'Comprobaciones completadas. La integracion y la recuperacion usan datos desechables.'
