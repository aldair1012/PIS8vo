# Plan de Implementación: Reestructuración Backend ZeaSys (Microservicios Lógicos + SOLID)

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `subagent-driven-development` (recomendada) o `executing-plans` para implementar tarea por tarea. Los pasos usan checkbox (`- [ ]`).
>
> **Convención para migraciones:** el código del sistema ACTUAL está versionado en el commit `e89067d` ("foto cero"). Cuando una tarea diga "mover verbatim", se refiere a copiar el bloque indicado del archivo actual conservando **cada string, número y mensaje de error exactamente igual** (la suite de contrato compara salidas). Las líneas citadas corresponden a ese commit.

**Goal:** Reorganizar `backend-api/` en 5 dominios aislados con capas estrictas (Http → Aplicación → Dominio ← Infraestructura), router declarativo, contenedor DI y contratos por interfaz, sin cambiar ni una ruta ni un byte del JSON de respuesta.

**Architecture:** Microservicios lógicos sobre XAMPP (Enfoque A aprobado). El núcleo (`Kernel/`) provee autoloader, router, contenedor, petición/respuesta, middleware y errores tipados. Cada dominio se migra en su propia fase con la suite de contrato como puerta de salida.

**Tech Stack:** PHP 8.2.12 (XAMPP, CLI en `C:\xampp\php\php.exe`), MySQL (XAMPP), Flask :5000 (ya operativo), sin Composer, sin frameworks nuevos.

**Precondiciones globales (verificar antes de cada fase):**
- Apache y MySQL de XAMPP corriendo (el sistema responde en `http://localhost/ZeaSys/`).
- Motor IA: la suite de contrato verifica `/health` y lo arranca con `auto_ia_server.bat` si está apagado.
- Todos los comandos se ejecutan desde `C:\xampp\htdocs\ZeaSys`.
- Todos los commits usan estilo conventional (`tipo(ambito): descripción`) en español.

---

## Fase F00 — Suite de contrato (red de verificación)

### Task 1: Crear la suite de contrato en PHP CLI

**Files:**
- Create: `backend-api/tests/contrato/ejecutar.php`
- Create: `backend-api/tests/contrato/README.md`

- [ ] **Step 1: Crear `backend-api/tests/contrato/ejecutar.php` con este contenido completo**

```php
<?php
/**
 * Suite de contrato de ZeaSys.
 * Recorre todos los flujos reales del API y captura/ compara la "huella" de cada respuesta.
 *
 * Uso:
 *   php tests/contrato/ejecutar.php --modo=capturar  [--destino=snapshots/antes/contrato.json]
 *   php tests/contrato/ejecutar.php --modo=comparar  [--destino=snapshots/antes/contrato.json] [--tolerancia=25]
 *
 * Códigos de salida: 0 = OK, 1 = diferencias detectadas, 2 = error de infraestructura.
 */

const BASE_URL  = 'http://localhost/ZeaSys/backend-api/public/index.php';
const IA_HEALTH = 'http://127.0.0.1:5000/health';
const BAT_IA    = 'C:\\xampp\\htdocs\\ZeaSys\\auto_ia_server.bat';

$opciones   = getopt('', ['modo::', 'destino::', 'tolerancia::']);
$modo       = $opciones['modo'] ?? 'capturar';
$dirBase    = __DIR__;
$destino    = $opciones['destino'] ?? ($dirBase . '/snapshots/antes/contrato.json');
if (!preg_match('~^([A-Za-z]:)?[\\\\/]~', (string) $destino)) {
    $destino = $dirBase . '/' . $destino;
}
$tolerancia = (float) ($opciones['tolerancia'] ?? 25);

// ---------------------------------------------------------------- utilidades

function say(string $texto): void { fwrite(STDOUT, $texto . PHP_EOL); }
function fail(string $texto): void { fwrite(STDERR, $texto . PHP_EOL); }

function asegurarFlask(): bool
{
    $ch = curl_init(IA_HEALTH);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 3, CURLOPT_CONNECTTIMEOUT => 2]);
    curl_exec($ch);
    $ok = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    if ($ok) { return true; }

    say('[*] Motor IA apagado; intentando arrancar con auto_ia_server.bat ...');
    if (PHP_OS_FAMILY === 'Windows' && file_exists(BAT_IA)) {
        pclose(popen('start /B "" "' . BAT_IA . '"', 'r'));
    }
    for ($i = 0; $i < 25; $i++) {
        sleep(1);
        $ch = curl_init(IA_HEALTH);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 3, CURLOPT_CONNECTTIMEOUT => 2]);
        curl_exec($ch);
        $ok = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
        curl_close($ch);
        if ($ok) { return true; }
    }
    return false;
}

function normalizarString(string $valor): string
{
    $valor = preg_replace('/contrato_\d+@/', 'contrato_<ts>@', $valor);
    $valor = preg_replace('/Simulación \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/u', 'Simulación <fecha>', $valor);
    $valor = preg_replace('/\d{2}\/\d{2}\/\d{4}/', '<fecha>', $valor);
    $valor = preg_replace('/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/', '<fecha>', $valor);
    $valor = preg_replace('/avatar_\d+_\d+\./', 'avatar_<ts>.', $valor);
    return $valor;
}

/** Normaliza claves volátiles (ids, fechas, tokens) para que la huella sea comparable. */
function normalizar(mixed $valor): mixed
{
    if (is_array($valor)) {
        $salida = [];
        foreach ($valor as $clave => $sub) {
            if (is_string($clave)
                && preg_match('/^(id|.*_id|.*token.*|.*_token)$/i', $clave)
                && !is_array($sub)
            ) {
                $salida[$clave] = '<volatil>';
            } elseif (is_string($clave) && preg_match('/^(fecha.*|.*_fecha|ultimo_acceso|fecha_registro)$/i', $clave)) {
                $salida[$clave] = '<volatil>';
            } else {
                $salida[$clave] = normalizar($sub);
            }
        }
        return $salida;
    }
    if (is_string($valor)) { return normalizarString($valor); }
    return $valor;
}

/** Etiqueta de tipo para la comparación estructural: integer y float son una sola familia. */
function etiquetaTipo(mixed $valor): string
{
    if (is_int($valor) || is_float($valor)) {
        return 'number';
    }
    return gettype($valor);
}

/** Devuelve la "forma" del JSON (rutas de claves + tipos) para comparación estructural. */
function estructura(mixed $valor, string $prefijo = ''): array
{
    if (is_array($valor)) {
        $esLista = array_is_list($valor);
        $salida  = [];
        if ($esLista) { $salida[$prefijo . '/{count}'] = 'int:' . count($valor); }
        foreach ($valor as $clave => $sub) {
            $hijo = $esLista ? $prefijo . '/*' : $prefijo . '/' . $clave;
            $salida = array_merge($salida, estructura($sub, $hijo));
        }
        return $salida;
    }
    return [$prefijo => etiquetaTipo($valor)];
}

function comparar(mixed $esperado, mixed $obtenido, string $ruta, string $modo, float $tolerancia, array &$diferencias): void
{
    if ($modo === 'estructural') {
        return; // se compara con estructura() antes de llamar aquí
    }
    if (is_array($esperado) || is_array($obtenido)) {
        if (!is_array($esperado) || !is_array($obtenido)) {
            $diferencias[] = "$ruta: tipo distinto (esperado " . gettype($esperado) . ", obtenido " . gettype($obtenido) . ')';
            return;
        }
        $clavesEsperadas = array_keys($esperado);
        foreach ($clavesEsperadas as $clave) {
            if (!array_key_exists($clave, $obtenido)) {
                $diferencias[] = "$ruta/$clave: FALTA en la respuesta nueva";
                continue;
            }
            comparar($esperado[$clave], $obtenido[$clave], "$ruta/$clave", $modo, $tolerancia, $diferencias);
        }
        foreach (array_keys($obtenido) as $clave) {
            if (!array_key_exists($clave, $esperado)) {
                $diferencias[] = "$ruta/$clave: CLAVE NUEVA no presente antes";
            }
        }
        return;
    }
    if (is_float($esperado) || is_float($obtenido) || (is_int($esperado) && is_int($obtenido))) {
        $a = (float) $esperado;
        $b = (float) $obtenido;
        if ($modo === 'tolerante') {
            $base = max(abs($a), abs($b), 1.0);
            if (abs($a - $b) / $base * 100 > $tolerancia) {
                $diferencias[] = "$ruta: número fuera de tolerancia (antes $a, ahora $b)";
            }
        } elseif ($a !== $b && abs($a - $b) > 1e-9) {
            $diferencias[] = "$ruta: número distinto (antes $a, ahora $b)";
        }
        return;
    }
    if ($esperado !== $obtenido) {
        $diferencias[] = "$ruta: valor distinto (antes " . json_encode($esperado, JSON_UNESCAPED_UNICODE) . ', ahora ' . json_encode($obtenido, JSON_UNESCAPED_UNICODE) . ')';
    }
}

// ---------------------------------------------------------------- cliente HTTP

final class ClienteHttp
{
    public function __construct(private string $cookieJar) {}

    public function solicitar(string $metodo, string $ruta, ?array $cuerpo = null): array
    {
        $ch = curl_init(BASE_URL . $ruta);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $metodo,
            CURLOPT_COOKIEJAR      => $this->cookieJar,
            CURLOPT_COOKIEFILE     => $this->cookieJar,
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        ]);
        if ($cuerpo !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($cuerpo, JSON_UNESCAPED_UNICODE));
        }
        $respuesta = curl_exec($ch);
        $codigo    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errorCurl = curl_error($ch);
        curl_close($ch);

        $json = is_string($respuesta) ? json_decode($respuesta, true) : null;
        return [
            'http'  => $codigo,
            'cuerpo' => $json !== null ? $json : (is_string($respuesta) ? $respuesta : ''),
            'curl_error' => $errorCurl ?: null,
        ];
    }

    /** Subida multipart (para /api/auth/upload-avatar, que lee $_FILES['foto']). */
    public function solicitarMultipart(string $ruta, array $campos): array
    {
        $ch = curl_init(BASE_URL . $ruta);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_COOKIEJAR      => $this->cookieJar,
            CURLOPT_COOKIEFILE     => $this->cookieJar,
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_POSTFIELDS     => $campos,
        ]);
        $respuesta = curl_exec($ch);
        $codigo    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errorCurl = curl_error($ch);
        curl_close($ch);

        $json = is_string($respuesta) ? json_decode($respuesta, true) : null;
        return [
            'http'  => $codigo,
            'cuerpo' => $json !== null ? $json : (is_string($respuesta) ? $respuesta : ''),
            'curl_error' => $errorCurl ?: null,
        ];
    }
}

// ---------------------------------------------------------------- escenario

function ejecutarEscenario(): array
{
    $cookieJar = sys_get_temp_dir() . '/zeasys_contrato_cookies_' . uniqid() . '.txt';
    $cliente   = new ClienteHttp($cookieJar);
    $email     = 'contrato_' . time() . '@zeasys.local';
    $password  = 'Contrato123!';
    $pasos     = [];
    $ids       = ['cultivo' => null, 'simulacion' => null];

    // PNG 1x1 válido para la prueba de subida de avatar
    $tmpPng = sys_get_temp_dir() . '/zeasys_contrato_avatar_' . uniqid() . '.png';
    file_put_contents($tmpPng, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));

    $registrar = function (string $nombre, string $metodo, string $ruta, ?array $cuerpo, string $volatilidad, bool $multipart = false) use (&$pasos, $cliente): array {
        $r = $multipart
            ? $cliente->solicitarMultipart($ruta, $cuerpo ?? [])
            : $cliente->solicitar($metodo, $ruta, $cuerpo);
        $pasos[] = [
            'nombre'      => $nombre,
            'metodo'      => $metodo,
            'ruta'        => $ruta,
            'volatilidad' => $volatilidad,
            'http'        => $r['http'],
            'cuerpo'      => normalizar($r['cuerpo']),
        ];
        if ($r['curl_error'] !== null) {
            fail("    curl_error en [$nombre]: {$r['curl_error']}");
        }
        return $r;
    };

    // 1) Salud del sistema
    $registrar('ia-status publico', 'GET', '/api/simulaciones/ia-status', null, 'tolerante');

    // 2) Cuenta de prueba
    $registrar('registro', 'POST', '/api/auth/register', [
        'nombre' => 'Contrato Test', 'correo' => $email,
        'contrasena' => $password, 'confirmar_contrasena' => $password,
    ], 'exacto');
    $registrar('me tras registro', 'GET', '/api/auth/me', null, 'exacto');
    $registrar('login', 'POST', '/api/auth/login', ['correo' => $email, 'contrasena' => $password, 'remember' => false], 'exacto');

    // 3) Parcela
    $registrar('cultivos lista vacia', 'GET', '/api/cultivos', null, 'exacto');
    $alta = $registrar('crear cultivo', 'POST', '/api/cultivos', [
        'nombre_parcela' => 'Lote Contrato', 'variedad_maiz' => 'Pioneer P4039',
        'tipo_maiz' => 'Duro Amarillo', 'ubicacion' => 'Quito - Pichincha', 'area' => 2.5,
        'latitud' => -0.1807, 'longitud' => -78.4678, 'altitud' => 2850, 'ph' => 6.2,
    ], 'exacto');
    $ids['cultivo'] = $alta['cuerpo']['cultivo']['id'] ?? null;
    if ($ids['cultivo'] === null) { fail('No se pudo obtener el id del cultivo creado.'); exit(2); }

    $registrar('cultivos lista con 1', 'GET', '/api/cultivos', null, 'exacto');
    $registrar('cultivos mapa', 'GET', '/api/cultivos/mapa', null, 'exacto');
    $registrar('valores ubicacion (externo)', 'GET', '/api/cultivos/valores-ubicacion?id=' . $ids['cultivo'], null, 'estructural');

    // 4) Simulación + explicaciones
    $sim = $registrar('simular', 'POST', '/api/simulaciones/simular', [
        'cultivo_id' => $ids['cultivo'], 'nombre' => 'Simulación Contrato', 'modelo_usado' => 'xgboost',
        'temperatura' => 24.5, 'humedad' => 70, 'precipitacion' => 800, 'fertilizante' => 150,
        'ph_suelo' => 6.2, 'tipo_suelo' => 'franco', 'area_simulada' => 2.5,
    ], 'tolerante');
    $ids['simulacion'] = $sim['cuerpo']['resultado']['simulacion_id'] ?? null;
    if ($ids['simulacion'] === null) { fail('No se pudo obtener el id de la simulación creada.'); exit(2); }

    $registrar('historial', 'GET', '/api/simulaciones/historial?anio=' . date('Y'), null, 'exacto');

    $registrar('explain cascada', 'POST', '/api/simulaciones/explain', [
        'nombre' => 'Cascada de Brechas de Rendimiento', 'cultivo_id' => $ids['cultivo'], 'anio' => (int) date('Y'),
        'valor' => '4.2', 'unidad' => 't/ha', 'estado' => 'riesgoso',
        'datos_grafico' => ['labels' => ['Potencial', 'Nitrógeno', 'Agua', 'Final'], 'proyeccion_actual' => [11.2, 9.1, 7.4, 6.9]],
    ], 'tolerante');
    $registrar('explain ROI', 'POST', '/api/simulaciones/explain', [
        'nombre' => 'ROI Anual', 'cultivo_id' => $ids['cultivo'], 'anio' => (int) date('Y'),
        'valor' => '35', 'unidad' => '%', 'estado' => 'optimo',
    ], 'tolerante');
    $registrar('explain probabilidad', 'POST', '/api/simulaciones/explain', [
        'nombre' => 'Probabilidad de Cosecha', 'cultivo_id' => $ids['cultivo'], 'anio' => (int) date('Y'),
        'valor' => '82%', 'unidad' => '', 'estado' => 'bueno',
    ], 'tolerante');

    // 5) Dashboards DSS
    $q = '?cultivo_id=' . $ids['cultivo'] . '&anio=' . date('Y');
    $registrar('dashboard yield', 'GET', '/api/yield' . $q, null, 'tolerante');
    $registrar('dashboard scenarios', 'GET', '/api/scenarios' . $q, null, 'tolerante');
    $registrar('dashboard climate (externo)', 'GET', '/api/climate' . $q, null, 'estructural');
    $registrar('dashboard financial', 'GET', '/api/financial' . $q, null, 'tolerante');

    // 6) Perfil y cierre
    $registrar('auth update', 'POST', '/api/auth/update', ['nombre' => 'Contrato Test Editado'], 'exacto');
    $registrar('subir avatar', 'POST', '/api/auth/upload-avatar', ['foto' => new CURLFile($tmpPng, 'image/png', 'contrato.png')], 'exacto', multipart: true);
    $registrar('eliminar avatar', 'POST', '/api/auth/delete-avatar', null, 'exacto');
    $registrar('sync google avatar', 'POST', '/api/auth/sync-google-avatar', ['foto_url' => 'https://lh3.googleusercontent.com/a/contrato_test=s96-c'], 'exacto');
    $registrar('eliminar avatar (google)', 'POST', '/api/auth/delete-avatar', null, 'exacto');
    $registrar('logout', 'POST', '/api/auth/logout', null, 'exacto');
    $registrar('login de nuevo', 'POST', '/api/auth/login', ['correo' => $email, 'contrasena' => $password, 'remember' => false], 'exacto');

    // 7) Limpieza (y contrato de eliminación)
    $registrar('eliminar simulacion', 'DELETE', '/api/simulaciones/eliminar?id=' . $ids['simulacion'], null, 'exacto');
    $registrar('eliminar cultivo', 'DELETE', '/api/cultivos?id=' . $ids['cultivo'], null, 'exacto');
    $registrar('eliminar cuenta', 'POST', '/api/auth/delete', null, 'exacto');
    $registrar('me tras eliminar cuenta', 'GET', '/api/auth/me', null, 'exacto');

    @unlink($cookieJar);
    @unlink($tmpPng);
    return $pasos;
}

// ---------------------------------------------------------------- main

say('== ZeaSys · Suite de contrato ==  modo: ' . $modo);

if (!asegurarFlask()) {
    fail('[X] El motor IA no responde en ' . IA_HEALTH . '. Encienda XAMPP/Flask e intente de nuevo.');
    exit(2);
}

$pasosNuevos = ejecutarEscenario();
say('[*] Pasos ejecutados: ' . count($pasosNuevos));

if ($modo === 'capturar') {
    if (!is_dir(dirname($destino))) { mkdir(dirname($destino), 0777, true); }
    file_put_contents($destino, json_encode([
        'fecha_captura' => date('c'),
        'base_url'      => BASE_URL,
        'tolerancia'    => $tolerancia,
        'pasos'         => $pasosNuevos,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    say('[OK] Huella capturada en: ' . $destino);
    exit(0);
}

if ($modo === 'comparar') {
    if (!is_file($destino)) {
        fail('[X] No existe la huella de referencia: ' . $destino);
        exit(2);
    }
    $referencia = json_decode(file_get_contents($destino), true);
    $pasosA      = $referencia['pasos'] ?? [];
    $total       = 0;

    foreach ($pasosNuevos as $i => $pasoB) {
        $pasoA = $pasosA[$i] ?? null;
        if ($pasoA === null) { fail("[X] Paso extra no presente en la huella: {$pasoB['nombre']}"); $total++; continue; }
        if ($pasoA['nombre'] !== $pasoB['nombre']) {
            fail("[X] Paso $i desalineado: antes '{$pasoA['nombre']}', ahora '{$pasoB['nombre']}'");
            $total++;
            continue;
        }

        $diferencias = [];
        if ($pasoA['http'] !== $pasoB['http']) {
            $diferencias[] = "HTTP: antes {$pasoA['http']}, ahora {$pasoB['http']}";
        }
        if ($pasoB['volatilidad'] === 'estructural') {
            $estructuraA = estructura($pasoA['cuerpo']);
            $estructuraB = estructura($pasoB['cuerpo']);
            comparar($estructuraA, $estructuraB, 'estructura', 'exacto', $tolerancia, $diferencias);
        } else {
            comparar($pasoA['cuerpo'], $pasoB['cuerpo'], 'cuerpo', $pasoB['volatilidad'], $tolerancia, $diferencias);
        }

        if ($diferencias === []) {
            say("[OK] {$pasoB['nombre']}");
        } else {
            $total += count($diferencias);
            fail("[X] {$pasoB['nombre']}");
            foreach ($diferencias as $d) { fail('      - ' . $d); }
        }
    }

    if (count($pasosNuevos) !== count($pasosA)) {
        fail('[X] Cantidad de pasos distinta: antes ' . count($pasosA) . ', ahora ' . count($pasosNuevos));
        $total++;
    }

    if ($total === 0) { say('== CONTRATO OK: sin diferencias =='); exit(0); }
    fail("== CONTRATO FALLIDO: $total diferencias ==");
    exit(1);
}

fail('Modo no reconocido: ' . $modo);
exit(2);
```

> Ajuste post-implementación (commit correctivo de F00): `normalizar()` además colapsa claves externas en vivo (`soilgrids`, `open_meteo` → `<externo>`) e items aleatorios de "fecha de siembra" (mt_rand de YieldController → `<volatil>`). El archivo `backend-api/tests/contrato/ejecutar.php` (versionado) es la fuente de verdad final de la suite. Además, las salidas derivadas del motor ML (rendimiento_estimado, produccion_total, rendimiento_promedio, blobs *_json) se colapsan a <externo:tipo>, y en modo tolerante los strings comparan esqueleto + números con ±25%: cubre la volatilidad de SoilGrids aguas abajo. Además, estructura() une integer/float en la familia "number" (json_encode emite 15.0 como 15).

- [ ] **Step 2: Crear `backend-api/tests/contrato/README.md`**

```markdown
# Suite de contrato ZeaSys

Verifica que la reestructuración del backend no cambia ninguna respuesta del API.

## Uso

```
C:\xampp\php\php.exe tests\contrato\ejecutar.php --modo=capturar
C:\xampp\php\php.exe tests\contrato\ejecutar.php --modo=comparar
```

- `capturar` guarda la huella en `tests/contrato/snapshots/antes/contrato.json`.
- `comparar` re-ejecuta el escenario y la compara (exit 0 = OK, 1 = diferencias, 2 = infraestructura).
- Volatilidad por paso: `exacto` (comparación estricta), `tolerante` (±25% en números), `estructural` (solo forma/tipos; para APIs externas).
- IDs, fechas, tokens y correos de prueba se normalizan automáticamente.

## Requisitos
Apache + MySQL de XAMPP corriendo. El motor IA se verifica y se arranca solo (auto_ia_server.bat).

## Limpieza manual (opcional, si una corrida se interrumpe)

```sql
DELETE FROM usuarios WHERE correo LIKE 'contrato\_%@zeasys.local';
```

```powershell
# Avatares residuales de las corridas de contrato (deleteAvatar no borra el archivo, igual que hoy)
Remove-Item backend-api\public\uploads\avatars\avatar_*_*.png -ErrorAction SilentlyContinue
```
```

- [ ] **Step 3: Ejecutar la captura y verificar que funciona**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=capturar`
Expected: lista de `[OK]` por paso (29 pasos), termina con `[OK] Huella capturada en: ...\snapshots\antes\contrato.json` y exit code 0.

- [ ] **Step 4: Ejecutar la comparación contra sí misma (control positivo)**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` y exit code 0.

### Task 2: Control negativo (probar que el comparador detecta fallos reales)

**Files:**
- Test: `backend-api/tests/contrato/snapshots/antes/contrato.json`

- [ ] **Step 1: Fabricar una huella dañada temporal**

Run (PowerShell):
```powershell
$origen   = "backend-api\tests\contrato\snapshots\antes\contrato.json"
$temporal = "$env:TEMP\contrato_danado.json"
$texto = [System.IO.File]::ReadAllText((Resolve-Path $origen), [System.Text.Encoding]::UTF8)
$texto = $texto.Replace('"titulo"', '"tituloX"')
[System.IO.File]::WriteAllText($temporal, $texto, (New-Object System.Text.UTF8Encoding($false)))
```

- [ ] **Step 2: Comparar contra la huella dañada — DEBE FALLAR**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar --destino="$env:TEMP\contrato_danado.json"`
Expected: `[X]` con diferencias tipo `CLAVE NUEVA`/`FALTA`, `== CONTRATO FALLIDO: N diferencias ==`, exit code 1.

- [ ] **Step 3: Limpiar el archivo temporal**

Run: `Remove-Item "$env:TEMP\contrato_danado.json"`

- [ ] **Step 4: Commit de la fase F00**

```bash
git add backend-api/tests/contrato
git commit -m "test(contrato): suite de contrato PHP CLI + huella del estado actual"
```

---

## Fase F01 — Kernel (router, contenedor, petición/respuesta, errores)

> **Puerta de salida F01:** la comparación de contrato pasa completa con el nuevo `index.php` y las rutas en tabla. Nada más cambia.

### Task 3: Autoloader PSR-4 + excepciones tipadas + manejador global

**Files:**
- Create: `backend-api/src/Kernel/AutoloaderPsr4.php`
- Create: `backend-api/src/Kernel/Errores/ZeaSysException.php`
- Create: `backend-api/src/Kernel/Errores/NoAutorizadoException.php`
- Create: `backend-api/src/Kernel/Errores/ValidacionException.php`
- Create: `backend-api/src/Kernel/Errores/AccesoDenegadoException.php`
- Create: `backend-api/src/Kernel/Errores/RecursoNoEncontradoException.php`
- Create: `backend-api/src/Kernel/Errores/ServicioExternoException.php`
- Create: `backend-api/src/Kernel/Errores/ManejadorErrores.php`

- [ ] **Step 1: Crear `AutoloaderPsr4.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class AutoloaderPsr4
{
    public static function registrar(string $dirBase, string $prefijo = 'ZeaSys\\'): void
    {
        spl_autoload_register(static function (string $clase) use ($dirBase, $prefijo): void {
            if (strncmp($clase, $prefijo, strlen($prefijo)) !== 0) {
                return;
            }
            $relativa = substr($clase, strlen($prefijo));
            $archivo  = $dirBase . '/' . str_replace('\\', '/', $relativa) . '.php';
            if (is_file($archivo)) {
                require $archivo;
            }
        });
    }
}
```

- [ ] **Step 2: Crear las excepciones (una clase por archivo, misma forma)**

`ZeaSysException.php`:
```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class ZeaSysException extends \Exception
{
    public function __construct(string $mensaje, private int $codigoHttp = 500, ?\Throwable $anterior = null)
    {
        parent::__construct($mensaje, 0, $anterior);
    }

    public function codigoHttp(): int
    {
        return $this->codigoHttp;
    }
}
```

`NoAutorizadoException.php`:
```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class NoAutorizadoException extends ZeaSysException
{
    public function __construct(string $mensaje = 'No autorizado. Debe iniciar sesión.')
    {
        parent::__construct($mensaje, 401);
    }
}
```

`ValidacionException.php`:
```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class ValidacionException extends ZeaSysException
{
    public function __construct(string $mensaje)
    {
        parent::__construct($mensaje, 400);
    }
}
```

`AccesoDenegadoException.php`:
```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class AccesoDenegadoException extends ZeaSysException
{
    public function __construct(string $mensaje)
    {
        parent::__construct($mensaje, 403);
    }
}
```

`RecursoNoEncontradoException.php`:
```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class RecursoNoEncontradoException extends ZeaSysException
{
    public function __construct(string $mensaje)
    {
        parent::__construct($mensaje, 404);
    }
}
```

`ServicioExternoException.php`:
```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class ServicioExternoException extends ZeaSysException
{
    public function __construct(string $mensaje)
    {
        parent::__construct($mensaje, 502);
    }
}
```

- [ ] **Step 3: Crear `ManejadorErrores.php`**

Formato de error IDÉNTICO al actual (`{"error": "..."}`; 500 con prefijo `Error interno del servidor: `):
```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

final class ManejadorErrores
{
    public static function registrar(): void
    {
        set_exception_handler(static function (\Throwable $e): void {
            $codigo  = $e instanceof ZeaSysException ? $e->codigoHttp() : 500;
            $mensaje = $e instanceof ZeaSysException
                ? $e->getMessage()
                : 'Error interno del servidor: ' . $e->getMessage();

            if (!headers_sent()) {
                http_response_code($codigo);
                header('Content-Type: application/json; charset=utf-8');
            }
            echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
        });
    }
}
```

- [ ] **Step 4: Verificar sintaxis y autoload**

Run:
```powershell
& C:\xampp\php\php.exe -l backend-api\src\Kernel\AutoloaderPsr4.php
& C:\xampp\php\php.exe -r "require 'backend-api/src/Kernel/AutoloaderPsr4.php'; ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/backend-api/src'); new ZeaSys\Kernel\Errores\ValidacionException('x'); echo 'autoload OK', PHP_EOL;"
```
Expected: `No syntax errors detected` y `autoload OK`.

### Task 4: Peticion + RespuestaJson + Cors

**Files:**
- Create: `backend-api/src/Kernel/Peticion.php`
- Create: `backend-api/src/Kernel/RespuestaJson.php`
- Create: `backend-api/src/Kernel/Cors.php`

- [ ] **Step 1: Crear `Peticion.php`** (lectura perezosa del cuerpo para no interferir con controladores legacy)

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Peticion
{
    private ?array $cuerpo = null;

    public function __construct(private string $metodo)
    {
    }

    public static function desdeGlobal(): self
    {
        return new self($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public function metodo(): string
    {
        return $this->metodo;
    }

    public function cuerpo(): array
    {
        if ($this->cuerpo === null) {
            $raw = file_get_contents('php://input');
            $json = json_decode($raw !== false ? $raw : '', true);
            $this->cuerpo = is_array($json) ? $json : $_POST;
        }
        return $this->cuerpo;
    }

    public function campo(string $clave, mixed $defecto = null): mixed
    {
        return $this->cuerpo()[$clave] ?? $defecto;
    }

    public function query(string $clave, mixed $defecto = null): mixed
    {
        return $_GET[$clave] ?? $defecto;
    }
}
```

- [ ] **Step 2: Crear `RespuestaJson.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class RespuestaJson
{
    public static function enviar(array $datos, int $codigo = 200): void
    {
        http_response_code($codigo);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    }
}
```

- [ ] **Step 3: Crear `Cors.php`** (comportamiento idéntico al actual: refleja el Origin con credenciales)

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Cors
{
    public static function aplicar(): void
    {
        $allowedOrigin = 'http://localhost:5173';
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            $origin = $_SERVER['HTTP_ORIGIN'];
            if (preg_match('/^https?:\/\//', $origin)) {
                $allowedOrigin = $origin;
            }
        }
        header("Access-Control-Allow-Origin: {$allowedOrigin}");
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    }
}
```

- [ ] **Step 4: Verificar sintaxis**

Run: `Get-ChildItem backend-api\src\Kernel\*.php | ForEach-Object { & C:\xampp\php\php.exe -l $_.FullName }`
Expected: `No syntax errors detected` para cada archivo.

### Task 5: Contenedor DI + nueva configuración + shims

**Files:**
- Create: `backend-api/src/Kernel/Container.php`
- Create: `backend-api/src/Config/aplicacion.php`
- Create: `backend-api/src/Config/constantes_negocio.php`
- Modify: `backend-api/config/database.php` (se convierte en shim)

- [ ] **Step 1: Crear `Container.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Container
{
    /** @var array<string, mixed> */
    private array $instancias = [];

    /** @var array<string, callable> */
    private array $fabricas = [];

    public function registrar(string $id, callable $fabrica): void
    {
        $this->fabricas[$id] = $fabrica;
    }

    public function get(string $id): mixed
    {
        if (array_key_exists($id, $this->instancias)) {
            return $this->instancias[$id];
        }
        if (!isset($this->fabricas[$id])) {
            throw new \RuntimeException("No hay definición en el contenedor para: {$id}");
        }
        return $this->instancias[$id] = ($this->fabricas[$id])($this);
    }

    public function tiene(string $id): bool
    {
        return isset($this->fabricas[$id]) || array_key_exists($id, $this->instancias);
    }
}
```

- [ ] **Step 2: Crear `src/Config/aplicacion.php`**

Contenido = copia verbatim del actual `backend-api/config/database.php` (líneas 1–51 del commit `e89067d`), **quitando** las dos constantes de negocio (`PRECIO_MAIZ_TON`, `PRECIO_MAIZ_FUENTE`), que pasan al paso siguiente. Encabezado nuevo:

```php
<?php
// src/Config/aplicacion.php — Infraestructura: base de datos, motor IA y sesión.
// (Resto del archivo: copia verbatim del config/database.php original SIN las constantes PRECIO_*)
```

- [ ] **Step 3: Crear `src/Config/constantes_negocio.php`**

```php
<?php
// src/Config/constantes_negocio.php — Constantes de negocio (agronomía/economía).

define('PRECIO_MAIZ_TON', 178); // USD/ton
define('PRECIO_MAIZ_FUENTE', 'MAG 2024');
```

- [ ] **Step 4: Convertir `backend-api/config/database.php` en shim temporal**

Reemplazar TODO el contenido por:
```php
<?php
// Shim temporal de compatibilidad (F01–F05). Al terminar la migración este archivo se elimina.
require_once __DIR__ . '/../src/Config/aplicacion.php';
require_once __DIR__ . '/../src/Config/constantes_negocio.php';
```

- [ ] **Step 5: Verificar que el sistema sigue operando**

Run: `(Invoke-WebRequest -Uri 'http://localhost/ZeaSys/backend-api/public/index.php/api/simulaciones/ia-status' -UseBasicParsing -TimeoutSec 5).StatusCode`
Expected: `200` (el endpoint público sigue funcionando con el shim).

- [ ] **Step 6: Commit del avance del kernel**

```bash
git add backend-api/src backend-api/config/database.php
git commit -m "refactor(backend): kernel de autoload, errores, peticion/respuesta, cors y contenedor DI"
```

### Task 6: Router declarativo + tabla de rutas + nuevo front controller

**Files:**
- Create: `backend-api/src/Kernel/AutenticacionMiddleware.php`
- Create: `backend-api/src/Kernel/Router.php`
- Create: `backend-api/src/Config/rutas.php`
- Create: `backend-api/src/Config/contenedor.php`
- Modify: `backend-api/public/index.php` (reemplazo completo)
- Backup: guardar el index anterior como `backend-api/public/index.legacy.php.txt` (referencia durante F01–F05; se borra en F06)

- [ ] **Step 1: Crear `AutenticacionMiddleware.php`** (preserva EXACTAMENTE el comportamiento actual: rutas públicas y cierre de sesión selectivo)

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

use ZeaSys\Kernel\Errores\NoAutorizadoException;

final class AutenticacionMiddleware
{
    /** Rutas que requieren la sesión ABIERTA (no se llama session_write_close). Idéntico al index original. */
    private const RUTAS_QUE_MANTIENEN_SESION = [
        'api/auth/login',
        'api/auth/register',
        'api/auth/google-login',
        'api/auth/logout',
        'api/auth/update',
        'api/auth/delete',
        'api/auth/upload-avatar',
        'api/auth/delete-avatar',
    ];

    /**
     * @param array{publica?: bool} $definicion
     */
    public function procesar(string $ruta, array $definicion): void
    {
        if (!($definicion['publica'] ?? false) && !isset($_SESSION['usuario_id'])) {
            throw new NoAutorizadoException();
        }
        if (!in_array($ruta, self::RUTAS_QUE_MANTIENEN_SESION, true)) {
            session_write_close();
        }
    }
}
```

- [ ] **Step 2: Crear `Router.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

use ZeaSys\Kernel\Errores\RecursoNoEncontradoException;

final class Router
{
    /**
     * @param array<string, array{controlador: string, accion?: string, acciones?: array<string, string>, publica?: bool}> $rutas
     */
    public function __construct(
        private Container $contenedor,
        private array $rutas,
        private AutenticacionMiddleware $middleware,
    ) {
    }

    /** Resolución de ruta IDÉNTICA a la del index.php original (action → PATH_INFO → URI). */
    public function resolverRutaActual(): string
    {
        $route = $_GET['action'] ?? '';
        if ($route === '') {
            $route = $_SERVER['PATH_INFO'] ?? '';
            if ($route === '') {
                $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
                $pos = strpos($uriPath, 'index.php');
                if ($pos !== false) {
                    $route = substr($uriPath, $pos + 9);
                } else {
                    $posApi = strpos($uriPath, '/api/');
                    if ($posApi !== false) {
                        $route = substr($uriPath, $posApi);
                    }
                }
            }
        }
        return trim($route, '/');
    }

    public function despachar(Peticion $peticion): void
    {
        $ruta = $this->resolverRutaActual();
        if (!isset($this->rutas[$ruta])) {
            throw new RecursoNoEncontradoException("Ruta no encontrada: {$ruta}");
        }

        $definicion = $this->rutas[$ruta];
        $this->middleware->procesar($ruta, $definicion);

        // Rutas con despacho por método HTTP (p. ej. api/cultivos) o de acción única.
        if (isset($definicion['acciones'])) {
            $accion = $definicion['acciones'][$peticion->metodo()] ?? null;
            if ($accion === null) {
                // Paridad con el switch original de api/cultivos.
                RespuestaJson::enviar(['error' => 'Método no permitido.'], 405);
                return;
            }
        } else {
            $accion = $definicion['accion'];
        }

        $controlador = $this->contenedor->get($definicion['controlador']);
        $controlador->{$accion}($peticion);
    }
}
```

- [ ] **Step 3: Crear `src/Config/rutas.php`** (TODAS las rutas actuales; en F01 apuntan a los controladores legacy sin namespace)

```php
<?php
// src/Config/rutas.php — Tabla declarativa de rutas del API.
// F01: controladores legacy (id = nombre de clase global). F02–F05 los reemplazan dominio a dominio.

return [
    // --- Autenticación ---
    'api/auth/login'               => ['controlador' => 'AuthController', 'accion' => 'login', 'publica' => true],
    'api/auth/register'            => ['controlador' => 'AuthController', 'accion' => 'registro', 'publica' => true],
    'api/auth/google-login'        => ['controlador' => 'AuthController', 'accion' => 'googleLogin', 'publica' => true],
    'api/auth/me'                  => ['controlador' => 'AuthController', 'accion' => 'me', 'publica' => true],
    'api/auth/logout'              => ['controlador' => 'AuthController', 'accion' => 'logout'],
    'api/auth/update'              => ['controlador' => 'AuthController', 'accion' => 'update'],
    'api/auth/upload-avatar'       => ['controlador' => 'AuthController', 'accion' => 'uploadAvatar'],
    'api/auth/delete-avatar'       => ['controlador' => 'AuthController', 'accion' => 'deleteAvatar'],
    'api/auth/sync-google-avatar'  => ['controlador' => 'AuthController', 'accion' => 'syncGoogleAvatar'],
    'api/auth/delete'              => ['controlador' => 'AuthController', 'accion' => 'eliminar'],

    // --- Cultivos / Parcelas ---
    'api/cultivos'                 => ['controlador' => 'CultivoController', 'acciones' => ['GET' => 'listar', 'POST' => 'crear', 'PUT' => 'actualizar', 'DELETE' => 'eliminar']],
    'api/cultivos/mapa'            => ['controlador' => 'CultivoController', 'accion' => 'mapa'],
    'api/cultivos/valores-ubicacion' => ['controlador' => 'CultivoController', 'accion' => 'obtenerValoresUbicacion'],

    // --- Simulaciones ---
    'api/simulaciones/simular'     => ['controlador' => 'SimulacionController', 'accion' => 'simular'],
    'api/simulaciones/historial'   => ['controlador' => 'SimulacionController', 'accion' => 'historial'],
    'api/simulaciones/eliminar'    => ['controlador' => 'SimulacionController', 'accion' => 'eliminar'],
    'api/simulaciones/ia-status'   => ['controlador' => 'SimulacionController', 'accion' => 'iaStatus', 'publica' => true],
    'api/simulaciones/explain'     => ['controlador' => 'SimulacionController', 'accion' => 'explain'],

    // --- DSS Dashboards ---
    'api/scenarios'                => ['controlador' => 'ScenarioController', 'accion' => 'index'],
    'api/climate'                  => ['controlador' => 'ClimateController', 'accion' => 'index'],
    'api/yield'                    => ['controlador' => 'YieldController', 'accion' => 'index'],
    'api/financial'                => ['controlador' => 'FinancialController', 'accion' => 'index'],
];
```

NOTA IMPORTANTE (paridad exacta con el original): `api/cultivos` es la ÚNICA ruta con despacho por método (`GET → listar`, `POST → crear`, `PUT → actualizar`, `DELETE → eliminar`, cualquier otro método → `405 {"error":"Método no permitido."}`). El resto de rutas acepta cualquier método, igual que hoy. El orden original se conserva: middleware de autenticación (401) ANTES del gate de método (405). Verificar en Step 6 con la suite.

- [ ] **Step 4: Crear `src/Config/contenedor.php`**

```php
<?php
// src/Config/contenedor.php — Bindings del contenedor DI.
// F01: controladores legacy. F02–F05 añaden los bindings de cada dominio nuevo.

use ZeaSys\Kernel\Container;

return static function (): Container {
    $contenedor = new Container();

    $legacy = [
        'AuthController',
        'CultivoController',
        'SimulacionController',
        'ScenarioController',
        'ClimateController',
        'YieldController',
        'FinancialController',
    ];
    foreach ($legacy as $clase) {
        $contenedor->registrar($clase, static fn (): object => new $clase());
    }

    return $contenedor;
};
```

- [ ] **Step 5: Reemplazar `backend-api/public/index.php` por el nuevo bootstrap**

Antes: copiar el actual a `backend-api/public/index.legacy.php.txt`.

```php
<?php
// public/index.php — Front controller de ZeaSys (delgado).
declare(strict_types=1);

use ZeaSys\Kernel\AutenticacionMiddleware;
use ZeaSys\Kernel\AutoloaderPsr4;
use ZeaSys\Kernel\Cors;
use ZeaSys\Kernel\Errores\ManejadorErrores;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\Router;

require __DIR__ . '/../src/Kernel/AutoloaderPsr4.php';
AutoloaderPsr4::registrar(__DIR__ . '/../src');

require_once __DIR__ . '/../src/Config/aplicacion.php';
require_once __DIR__ . '/../src/Config/constantes_negocio.php';

ManejadorErrores::registrar();
Cors::aplicar();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_name(SESSION_NAME);
session_start([
    'cookie_lifetime' => 0,
    'cookie_secure'   => false, // desarrollo local
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

error_reporting(E_ALL);
ini_set('display_errors', '1');

// F01: controladores legacy (globales, sin namespace). Se eliminan fase a fase (F02–F05) y en F06 no queda ninguno.
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/CultivoController.php';
require_once __DIR__ . '/../controllers/SimulacionController.php';
require_once __DIR__ . '/../controllers/ScenarioController.php';
require_once __DIR__ . '/../controllers/ClimateController.php';
require_once __DIR__ . '/../controllers/YieldController.php';
require_once __DIR__ . '/../controllers/FinancialController.php';

$contenedor = (require __DIR__ . '/../src/Config/contenedor.php')();
$rutas      = require __DIR__ . '/../src/Config/rutas.php';

$router = new Router($contenedor, $rutas, new AutenticacionMiddleware());
$router->despachar(Peticion::desdeGlobal());
```

NOTA sobre `SESSION_NAME`: el original usaba el literal `'AGROPREDICT_SESSION'` y `aplicacion.php` define `SESSION_NAME` con ese mismo valor — verificar que coincida antes de continuar.

- [ ] **Step 6: Verificación de la puerta F01 — suite de contrato completa**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` (exit 0). Si algo falla: corregir SOLO el kernel (las rutas/acciones deben replicar exactamente el comportamiento del switch original) y repetir.

- [ ] **Step 7: Commit de la fase F01**

```bash
git add backend-api/src backend-api/public/index.php backend-api/public/index.legacy.php.txt
git commit -m "refactor(backend): front controller delgado con router declarativo, DI y rutas en tabla"
```

## Fase F02 — Dominio Autenticación

> **Puerta de salida:** `CONTRATO OK` con el dominio nuevo enrutado y `AuthController` legacy eliminado.
>
> **Convención de portado (válida F02–F05):** para cada clase nueva que sea un *portado* indico firma, rol, reglas mecánicas exactas y su origen en el commit `e89067d`. El código ya existe: se mueve, no se reescribe. Toda respuesta (`echo json_encode(...); exit;`) pasa a `return [...];` y todo error pasa a excepción tipada **conservando el mensaje literal** (la suite compara mensajes).

### Task 7: Config de Google + contratos e infraestructura de Autenticación

**Files:**
- Create: `backend-api/src/Config/google.php`
- Modify: `backend-api/config/google.php` (shim)
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/UsuarioRepositoryInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/VerificadorTokenGoogleInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/AlmacenAvatarInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/GestorSesionInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/GestorSesion.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/VerificadorTokenGoogle.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/AlmacenAvatarArchivos.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/UsuarioRepositoryMysql.php`

- [ ] **Step 1: Mover `config/google.php` a `src/Config/google.php`** (contenido verbatim, 7 líneas) y dejar `backend-api/config/google.php` como shim:

```php
<?php
// Shim temporal (F02–F06).
require_once __DIR__ . '/../src/Config/google.php';
```

- [ ] **Step 2: Crear `UsuarioRepositoryInterface.php`** — refleja EXACTAMENTE los métodos públicos de `models/Usuario.php` (líneas 29–158):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface UsuarioRepositoryInterface
{
    /** @return array<string, mixed>|false  (false = credenciales inválidas o inactivo) */
    public function login(string $correo, string $contrasena);

    public function registrar(string $nombre, string $correo, string $contrasena): int;

    public function existeCorreo(string $correo): bool;

    /** @return array<string, mixed>|null */
    public function obtenerPorId(int $id): ?array;

    public function actualizarFotoPerfil(int $id, ?string $fotoUrl, int $esGoogle = 0): bool;

    public function existeCorreoParaOtro(string $correo, int $id): bool;

    public function obtenerPasswordHash(int $id): ?string;

    public function actualizarUsuario(int $id, string $nombre, ?string $contrasenaHash = null): bool;

    public function eliminarUsuario(int $id): bool;

    /** @return array<string, mixed>|false */
    public function buscarOCrearPorGoogle(string $nombre, string $correo, ?string $picture = null);
}
```

- [ ] **Step 3: Crear `VerificadorTokenGoogleInterface.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface VerificadorTokenGoogleInterface
{
    /**
     * Valida el id_token contra Google.
     * @return array{nombre: string, correo: string, picture: string}
     * @throws \ZeaSys\Kernel\Errores\NoAutorizadoException token inválido/expirado o aud distinta
     * @throws \ZeaSys\Kernel\Errores\ValidacionException sin correo en el payload
     */
    public function verificar(string $idToken): array;
}
```

- [ ] **Step 4: Crear `AlmacenAvatarInterface.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface AlmacenAvatarInterface
{
    /**
     * Valida y guarda una foto de perfil.
     * @param array<string, mixed> $archivo  Entrada de $_FILES (p. ej. $_FILES['foto'])
     * @return string URL pública: /backend-api/public/uploads/avatars/...
     */
    public function guardar(array $archivo, int $usuarioId): string;
}
```

- [ ] **Step 5: Crear `GestorSesionInterface.php`** y `GestorSesion.php` (encapsula las claves `usuario_id`, `nombre`, `correo` — las únicas usadas hoy):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface GestorSesionInterface
{
    /** @param array{id: int|string, nombre: string, correo: string} $usuario */
    public function iniciar(array $usuario): void;

    /** Idéntico al logout actual: session_destroy() + session_start(). */
    public function cerrar(): void;

    public function usuarioId(): ?int;

    public function actualizarNombre(string $nombre): void;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface;

final class GestorSesion implements GestorSesionInterface
{
    public function iniciar(array $usuario): void
    {
        $_SESSION['usuario_id'] = (int) $usuario['id'];
        $_SESSION['nombre']     = $usuario['nombre'];
        $_SESSION['correo']     = $usuario['correo'];
    }

    public function cerrar(): void
    {
        session_destroy();
        session_start();
    }

    public function usuarioId(): ?int
    {
        return isset($_SESSION['usuario_id']) ? (int) $_SESSION['usuario_id'] : null;
    }

    public function actualizarNombre(string $nombre): void
    {
        $_SESSION['nombre'] = $nombre;
    }
}
```

- [ ] **Step 6: Crear `VerificadorTokenGoogle.php`** (código completo; es el bloque verbatim de `googleLogin()` líneas 119–153, convertido a excepciones):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class VerificadorTokenGoogle implements VerificadorTokenGoogleInterface
{
    public function verificar(string $idToken): array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($response)) {
            throw new NoAutorizadoException('El token de Google no es válido o ha expirado.');
        }

        $payload = json_decode($response, true);
        $email   = trim($payload['email'] ?? '');
        $nombre  = trim($payload['name'] ?? 'Usuario de Google');
        $picture = trim($payload['picture'] ?? '');
        if (!empty($picture)) {
            $picture = preg_replace('/=s\d+(-c)?$/i', '=s400', $picture);
        }
        $aud = trim($payload['aud'] ?? '');

        if (empty($email)) {
            throw new ValidacionException('No se pudo obtener el correo del token de Google.');
        }

        if (defined('GOOGLE_CLIENT_ID') && GOOGLE_CLIENT_ID !== '' && $aud !== GOOGLE_CLIENT_ID) {
            throw new NoAutorizadoException('La audiencia del token de Google no coincide con la aplicación registrada.');
        }

        return ['nombre' => $nombre, 'correo' => $email, 'picture' => $picture];
    }
}
```

- [ ] **Step 7: Crear `AlmacenAvatarArchivos.php`** (código completo; port de `uploadAvatar()` líneas 368–432, con las 4 validaciones y mensajes EXACTOS):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Errores\ZeaSysException;

final class AlmacenAvatarArchivos implements AlmacenAvatarInterface
{
    private const MAX_BYTES = 5242880; // 5 MB
    private const MIMES_PERMITIDOS = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    public function guardar(array $archivo, int $usuarioId): string
    {
        if (($archivo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ValidacionException('No se ha seleccionado ningún archivo o ocurrió un error al subirlo.');
        }

        if ($archivo['size'] > self::MAX_BYTES) {
            throw new ValidacionException('El archivo supera el tamaño máximo permitido de 5 MB.');
        }

        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $archivo['tmp_name']);
        finfo_close($finfo);

        if (!array_key_exists($mimeType, self::MIMES_PERMITIDOS)) {
            throw new ValidacionException('El formato del archivo no es permitido. Suba una imagen JPG, PNG, WEBP o GIF.');
        }
        $ext = self::MIMES_PERMITIDOS[$mimeType];

        $uploadDir = __DIR__ . '/../../../../public/uploads/avatars/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = 'avatar_' . $usuarioId . '_' . time() . '.' . $ext;
        if (!move_uploaded_file($archivo['tmp_name'], $uploadDir . $filename)) {
            throw new ZeaSysException('No se pudo guardar la imagen en el servidor.', 500);
        }

        return '/backend-api/public/uploads/avatars/' . $filename;
    }
}
```

- [ ] **Step 8: Crear `UsuarioRepositoryMysql.php`** — copia `models/Usuario.php` completo y aplica SOLO estos cambios mecánicos:
  1. `namespace ZeaSys\Dominios\Autenticacion\Infraestructura;`
  2. `final class UsuarioRepositoryMysql implements UsuarioRepositoryInterface`
  3. Constructor: `public function __construct(private \PDO $db) {}` — **se conserva `$this->asegurarColumnasPerfil();` tal cual** (comportamiento actual; queda registrado como deuda en ADR-07).
  4. Eliminar `require_once __DIR__ . '/../config/database.php';`
  5. Todo lo demás (métodos, SQL, mensajes) verbatim.

- [ ] **Step 9: Verificar sintaxis de todo lo creado**

Run: `Get-ChildItem backend-api\src\Dominios -Recurse -Filter *.php | ForEach-Object { & C:\xampp\php\php.exe -l $_.FullName }`
Expected: `No syntax errors detected` en todos.

### Task 8: AutenticacionService + AuthController nuevo + switch de rutas

**Files:**
- Create: `backend-api/src/Dominios/Autenticacion/Aplicacion/AutenticacionService.php`
- Create: `backend-api/src/Dominios/Autenticacion/Http/AuthController.php`
- Modify: `backend-api/src/Config/contenedor.php` (bindings del dominio)
- Modify: `backend-api/src/Config/rutas.php` (ids del dominio)
- Modify: `backend-api/public/index.php` (quitar `require_once` de AuthController legacy)
- Delete: `backend-api/controllers/AuthController.php`

- [ ] **Step 1: Crear `AutenticacionService.php`** — port método a método del `AuthController` legacy (origen: `e89067d:backend-api/controllers/AuthController.php`):

Tabla de mapeo (método nuevo ← método legacy / líneas):

| Método del servicio | Origen | Reemplazos mecánicos |
|---|---|---|
| `me(): array` | `me()` 16–40 | `$_SESSION['usuario_id']` → `$this->sesion->usuarioId()` |
| `login(Peticion $p): array` | `login()` 41–103 | sesión → `$this->sesion->iniciar($usuario)`; conservar `setcookie` de "remember" verbatim |
| `googleLogin(Peticion $p): array` | `googleLogin()` 104–194 | bloque cURL+tipo 119–153 → `$this->google->verificar($idToken)`; `if ($usuario)` falso → `throw new AccesoDenegadoException('Este usuario está desactivado en el sistema.')` |
| `registro(Peticion $p): array` | `registro()` 196–267 | correo duplicado → `throw new ZeaSysException('Este correo ya está registrado.', 409)` |
| `logout(): array` | `logout()` 269–276 | `session_destroy(); session_start();` → `$this->sesion->cerrar()` |
| `update(Peticion $p): array` | `update()` 278–355 | `$_SESSION['nombre'] = $nombre;` → `$this->sesion->actualizarNombre($nombre)` |
| `uploadAvatar(): array` | `uploadAvatar()` 357–433 | validaciones 368–405 → `$this->avatares->guardar($_FILES['foto'] ?? [], $usuarioId)` |
| `deleteAvatar(): array` | `deleteAvatar()` 435–461 | — |
| `syncGoogleAvatar(Peticion $p): array` | `syncGoogleAvatar()` 463–502 | — |
| `eliminar(): array` | `eliminar()` 504–527 | `session_destroy(); session_start();` → `$this->sesion->cerrar()` |

Reglas de conversión (todas):
- `http_response_code(401) + echo json_encode(['error' => M]); exit;` → `throw new NoAutorizadoException(M)` (M literal).
- `... 400 ...` → `throw new ValidacionException(M)`. `403` → `AccesoDenegadoException(M)`. `404` → `RecursoNoEncontradoException(M)`. `500` → relanzar como `ZeaSysException("Error al ...: " . $e->getMessage(), 500)` conservando el prefijo del mensaje original.
- Éxitos → `return [ ... ];` (payload literal).
- Peticiones: `file_get_contents('php://input') + json_decode` → `$p->cuerpo()`; `$_GET['x']` → `$p->query('x')`.
- Constructor:

```php
public function __construct(
    private UsuarioRepositoryInterface $usuarios,
    private VerificadorTokenGoogleInterface $google,
    private AlmacenAvatarInterface $avatares,
    private GestorSesionInterface $sesion,
) {
}
```

- [ ] **Step 2: Crear `AuthController.php` nuevo** (código completo — capa Http ultra-delgada):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Http;

use ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class AuthController
{
    public function __construct(private AutenticacionService $servicio)
    {
    }

    public function me(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->me()); }
    public function login(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->login($peticion)); }
    public function googleLogin(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->googleLogin($peticion)); }
    public function registro(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->registro($peticion)); }
    public function logout(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->logout()); }
    public function update(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->update($peticion)); }
    public function uploadAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->uploadAvatar()); }
    public function deleteAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->deleteAvatar()); }
    public function syncGoogleAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->syncGoogleAvatar($peticion)); }
    public function eliminar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->eliminar()); }
}
```

- [ ] **Step 3: Añadir bindings en `contenedor.php`** (dentro del closure, ANTES de devolver; añadir el `require_once` de google y los `use`):

```php
require_once __DIR__ . '/google.php';

$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\UsuarioRepositoryMysql =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\UsuarioRepositoryMysql(getConnection())
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\VerificadorTokenGoogle =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\VerificadorTokenGoogle()
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\AlmacenAvatarArchivos =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\AlmacenAvatarArchivos()
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\GestorSesion =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\GestorSesion()
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService::class,
    static fn (Container $c): \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService =>
        new \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService(
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface::class),
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface::class),
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface::class),
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface::class),
        )
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Http\AuthController::class,
    static fn (Container $c): \ZeaSys\Dominios\Autenticacion\Http\AuthController =>
        new \ZeaSys\Dominios\Autenticacion\Http\AuthController(
            $c->get(\ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService::class)
        )
);
```

Y ELIMINAR el string `'AuthController'` del array `$legacy` (el loop de registros legacy sigue para los demás dominios).

- [ ] **Step 4: Actualizar `rutas.php`** — reemplazar TODOS los `'controlador' => 'AuthController'` por `'controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class` (10 rutas).

- [ ] **Step 5: Limpiar legacy**: en `public/index.php` eliminar la línea `require_once __DIR__ . '/../controllers/AuthController.php';` y ejecutar `git rm backend-api/controllers/AuthController.php`. Verificar que nada más lo referencia:

Run: `rg -n "AuthController" backend-api --glob "!tests/**" --glob "!src/**"`
Expected: solo `public/index.legacy.php.txt` (referencia histórica) — si aparecen controladores de otros dominios referenciándolo, detenerse y revisar.

- [ ] **Step 6: Verificación de la puerta F02**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==`. Este paso cubre registro, login, me, update, logout, avatares (subida/borrado/sync) y eliminación de cuenta contra la huella del sistema original.

- [ ] **Step 7: Commit de la fase F02**

```bash
git add -A backend-api/src backend-api/config/google.php backend-api/public/index.php backend-api/controllers/AuthController.php
git commit -m "refactor(auth): dominio Autenticacion con servicio, repositorio, verificador Google y gestor de sesion"
```

---

## Fase F03 — Dominios Terreno y Lotes

> **Puerta de salida:** `CONTRATO OK`. `valores-ubicacion` y `climate` (comparación estructural) validan la extracción del acceso a Open-Meteo/SoilGrids.

### Task 9: Dominio Terreno (datos de clima/suelo + caché de archivos)

**Files:**
- Create: `backend-api/src/Dominios/Terreno/Dominio/CacheInterface.php`
- Create: `backend-api/src/Dominios/Terreno/Dominio/ProveedorClimaInterface.php`
- Create: `backend-api/src/Dominios/Terreno/Dominio/ProveedorSueloInterface.php`
- Create: `backend-api/src/Dominios/Terreno/Infraestructura/CacheArchivos.php`
- Create: `backend-api/src/Dominios/Terreno/Infraestructura/ProveedorOpenMeteo.php`
- Create: `backend-api/src/Dominios/Terreno/Infraestructura/ProveedorSoilGrids.php`
- Create: `backend-api/src/Dominios/Terreno/Aplicacion/ServicioDatosTerreno.php`

- [ ] **Step 1: Inventario obligatorio antes de mover**

Run: `rg -n "curl_|_URL|file_put_contents|file_get_contents|precision_data|usleep|time\(\)" backend-api/controllers/ClimateController.php`
Leer `ClimateController::consultarDatosApiPrecision()` (líneas 28–230) y clasificar cada bloque en: (a) caché de archivo, (b) llamada Open-Meteo, (c) llamada SoilGrids, (d) ensamblado/márgenes de error. Objetivo: mover (a)→`CacheArchivos`, (b)→`ProveedorOpenMeteo`, (c)→`ProveedorSoilGrids`, (d)→`ServicioDatosTerreno`. **Sin alterar URLs, timeouts, TTL (24 h), rutas de caché (`backend-api/data/cache/precision_data_*.json`), valores de fallback ni formato de retorno.**

- [ ] **Step 2: Crear las interfaces (código completo)**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface CacheInterface
{
    /** @return array<string, mixed>|null  null = no existe o expiró */
    public function obtener(string $clave): ?array;

    /** @param array<string, mixed> $valor */
    public function guardar(string $clave, array $valor): void;

    /** Elimina precision_data_*.json con más de 24 h (port de limpiarCacheExpirada()). */
    public function limpiarExpirados(): void;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorClimaInterface
{
    /** @return array<string, mixed>  bloque 'clima' tal como lo arma el método original */
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorSueloInterface
{
    /** @return array<string, mixed>  bloque 'suelo' tal como lo arma el método original */
    public function obtenerSuelo(float $latitud, float $longitud): array;
}
```

- [ ] **Step 3: Crear `CacheArchivos.php`** — implementa `CacheInterface` moviendo los bloques detectados en Step 1 + el cuerpo de `SimulacionController::limpiarCacheExpirada()` (líneas 29–52). Directorio base: `__DIR__ . '/../../../../data/cache'` (ajustar al equivalente real de `backend-api/data/cache`). Nombre de archivo: mismo criterio que el original (`precision_data_{lat}_{lng}.json`).

- [ ] **Step 4: Crear `ProveedorOpenMeteo.php` y `ProveedorSoilGrids.php`** — cada uno mueve su bloque de cURL verbatim (URL, timeouts, user-agent si lo hubiera). Lanzan `ServicioExternoException` con el mensaje original del bloque en caso de fallo, para que `ServicioDatosTerreno` aplique el fallback exactamente como hoy.

- [ ] **Step 5: Crear `ServicioDatosTerreno.php`**

```php
final class ServicioDatosTerreno
{
    public function __construct(
        private CacheInterface $cache,
        private ProveedorClimaInterface $clima,
        private ProveedorSueloInterface $suelo,
    ) {
    }

    /**
     * Puerto literal de ClimateController::consultarDatosApiPrecision() (líneas 28–230).
     * @return array<string, mixed> misma estructura exacta (clima, suelo, source, ...)
     */
    public function obtener(float $latitud, float $longitud, ?float $altitud = null): array
```

El cuerpo del servicio: 1) consulta `$this->cache->obtener(...)`; 2) si falta, pide clima y suelo a los proveedores dentro del MISMO try/catch del original; 3) guarda en caché con el mismo formato; 4) devuelve la misma estructura (incluido `source`). Valores de fallback idénticos al original.

- [ ] **Step 6: Verificar sintaxis + commit intermedio**

```bash
Get-ChildItem backend-api\src\Dominios\Terreno -Recurse -Filter *.php | ForEach-Object { & C:\xampp\php\php.exe -l $_.FullName }
git add backend-api/src/Dominios/Terreno
git commit -m "refactor(terreno): dominio Terreno con cache de archivos y proveedores clima/suelo desacoplados"
```

### Task 10: Dominio Lotes (Cultivos)

**Files:**
- Create: `backend-api/src/Dominios/Lotes/Dominio/ValidadorLimitesEcuador.php`
- Create: `backend-api/src/Dominios/Lotes/Dominio/CultivoRepositoryInterface.php`
- Create: `backend-api/src/Dominios/Lotes/Infraestructura/CultivoRepositoryMysql.php`
- Create: `backend-api/src/Dominios/Lotes/Aplicacion/CultivoService.php`
- Create: `backend-api/src/Dominios/Lotes/Http/CultivoController.php`
- Delete (al final de la fase): `backend-api/controllers/CultivoController.php`, `backend-api/models/Cultivo.php`

- [ ] **Step 1: Crear `ValidadorLimitesEcuador.php`** (código completo; mensajes y límites EXACTOS del original; ¡preservar el comportamiento de `actualizar()`, donde null significa "no validar ese campo" — incluyendo la precedencia `&&`/`||` original!)

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Lotes\Dominio;

final class ValidadorLimitesEcuador
{
    public const LAT_MIN = -5.2;
    public const LAT_MAX = 1.6;
    public const LNG_MIN = -81.6;
    public const LNG_MAX = -75.0;
    public const MENSAJE_FUERA_DE_RANGO = 'Las coordenadas del lote están fuera del cuadrante de Ecuador continental (Latitud: [-5.2, 1.6], Longitud: [-81.6, -75.0]). El sistema DSS está restringido únicamente a parcelas dentro del territorio ecuatoriano.';

    /** Crear: exige ambas coordenadas presentes y dentro de rango (port de líneas 72–73). */
    public function validoAlCrear(?float $latitud, ?float $longitud): bool
    {
        return $latitud !== null && $longitud !== null
            && $latitud >= self::LAT_MIN && $latitud <= self::LAT_MAX
            && $longitud >= self::LNG_MIN && $longitud <= self::LNG_MAX;
    }

    /** Actualizar: null = no validar ese campo (port de líneas 146–147, con su precedencia original). */
    public function validoAlActualizar(?float $latitud, ?float $longitud): bool
    {
        return !($latitud !== null && ($latitud < self::LAT_MIN || $latitud > self::LAT_MAX)
            || $longitud !== null && ($longitud < self::LNG_MIN || $longitud > self::LNG_MAX));
    }
}
```

- [ ] **Step 2: Crear `CultivoRepositoryInterface.php`** — calcado de `models/Cultivo.php` (métodos: `crear`, `obtenerPorUsuario`, `obtenerPorId`, `obtenerConCoordenadas`, `actualizar`, `eliminar`, `contarPorUsuario`, `areaTotalPorUsuario`).

- [ ] **Step 3: Crear `CultivoRepositoryMysql.php`** — copia verbatim de `models/Cultivo.php` con los mismos 4 cambios mecánicos de F02 Task 7 Step 8 (namespace, implements, PDO por constructor, quitar require).

- [ ] **Step 4: Crear `CultivoService.php`** — port de `CultivoController` (líneas 25–281). Mapeo:

| Método nuevo | Origen | Notas |
|---|---|---|
| `listar(int $usuarioId): array` | `listar()` 25–32 | devuelve el array directo |
| `crear(int $usuarioId, Peticion $p): array` | `crear()` 34–93 | validaciones → `ValidacionException`; coordenadas → `ValidadorLimitesEcuador::validoAlCrear` + `ValidacionException(MENSAJE_FUERA_DE_RANGO)` |
| `actualizar(int $usuarioId, Peticion $p): array` | `actualizar()` 95–167 | permisos → `AccesoDenegadoException('No tiene permisos para editar esta parcela.')` |
| `eliminar(int $usuarioId, Peticion $p): array` | `eliminar()` 169–197 | id de `$p->query('id')` |
| `mapa(): array` | `mapa()` 199–206 | — |
| `obtenerValoresUbicacion(int $usuarioId, Peticion $p): array` | `obtenerValoresUbicacion()` 208–281 | **elimina** `new ClimateController()`: usa `ServicioDatosTerreno` inyectado (`$this->terreno->obtener($lat, $lng, $altitud)`); el bloque `if ($lat !== null && $lng !== null)` y el catch con `'Fallback por error en API: '` se conservan idénticos |

Constructor: `CultivoRepositoryInterface`, `ValidadorLimitesEcuador`, `ServicioDatosTerreno`, `GestorSesionInterface` (no — el usuarioId llega por parámetro desde el controller; sin GestorSesion aquí).

- [ ] **Step 5: Crear `CultivoController.php` nuevo** (patrón idéntico al de AuthController): 6 métodos ultra-delgados que llaman `RespuestaJson::enviar($this->servicio->...( ... ))`; el usuarioId se obtiene en el controller: `$usuarioId = (int) $_SESSION['usuario_id'];` — añadir `private function usuarioId(): int { return (int) $_SESSION['usuario_id']; }`. (El middleware ya garantiza la sesión para estas rutas.)

- [ ] **Step 6: Bindings + rutas + limpieza legacy**
  - `contenedor.php`: bindings `CultivoRepositoryInterface`→`CultivoRepositoryMysql(getConnection())`, `ValidadorLimitesEcuador`, `ServicioDatosTerreno` (con `CacheArchivos`, `ProveedorOpenMeteo`, `ProveedorSoilGrids`), `CultivoService`, `CultivoController`. Quitar `'CultivoController'` del array legacy.
  - `rutas.php`: las 3 rutas de cultivos → `\ZeaSys\Dominios\Lotes\Http\CultivoController::class` (conservar `'acciones' => [...]`).
  - `index.php`: quitar `require_once ... CultivoController.php`.
  - `git rm backend-api/controllers/CultivoController.php` (y `models/Cultivo.php` SOLO si ya nadie lo usa: `rg -n "models/Cultivo" backend-api` — `SimulacionController` legacy todavía lo usa; si es el caso, se borra en F04).

- [ ] **Step 7: Verificación de la puerta F03 + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` (cubre CRUD de cultivos completo, mapa y valores de ubicación externos).

```bash
git add -A backend-api
git commit -m "refactor(lotes): dominio Lotes + terreno inyectado; cultivos sin acoplamiento entre controladores"
```

---

## Fase F04 — Dominio Simulaciones + Explicabilidad (Strategy)

> **Puerta de salida:** `CONTRATO OK`, con especial atención a los 3 pasos `explain` (cascada/ROI/probabilidad) y al paso `simular` (motor Flask).

### Task 11: Motor IA desacoplado (rompe la violación DIP del modelo)

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Dominio/MotorPrediccionInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Dominio/GestorMotorIaInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Infraestructura/ClienteMotorFlask.php`
- Create: `backend-api/src/Dominios/Simulaciones/Infraestructura/GestorMotorIa.php`

- [ ] **Step 1: Crear interfaces (código completo)**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface MotorPrediccionInterface
{
    /** @param array<string, mixed> $datos @return array<string, mixed>   respuesta cruda del motor (con success/error) */
    public function predecir(array $datos): array;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface GestorMotorIaInterface
{
    public function estaActivo(): bool;

    /** @return array<string, mixed>|null */
    public function detallesSalud(): ?array;

    public function iniciar(): bool;

    /** @return array{running: bool, message: string, ...} */
    public function asegurarActivo(int $maxWaitSeconds = 15): array;

    /** @return array<string, mixed> */
    public function estado(bool $tryStart = false): array;
}
```

- [ ] **Step 2: Crear `ClienteMotorFlask.php`** — port verbatim de `Simulacion::predecir()` (`models/Simulacion.php` líneas 16–68): mismo endpoint `IA_SERVER_URL . '/predict'`, mismos timeouts/JSON. Constructor sin dependencias (usa la constante).

- [ ] **Step 3: Crear `GestorMotorIa.php`** — port verbatim de `IaServerHelper` (líneas 8–114): `isRunning→estaActivo`, `getHealthDetails→detallesSalud`, `start→iniciar` (mismo `auto_ia_server.bat`, misma ruta de proceso), `ensureRunning→asegurarActivo`, `getStatus→estado`. **Mismos mensajes y misma lógica de arranque del .bat.**

### Task 12: Repositorio de Simulaciones

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Dominio/SimulacionRepositoryInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Infraestructura/SimulacionRepositoryMysql.php`

- [ ] **Step 1: Interface** — refleja `models/Simulacion.php` SIN `predecir()`: `guardar(array $datos, array $resultado): int`, `obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null): array`, `obtenerPorId(int $id): ?array`, `obtenerEstadisticas(int $usuarioId, ?int $year = null): array`, `obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array`, `eliminar(int $id): bool`, `contarPorUsuario(int $usuarioId): int`.
- [ ] **Step 2: Implementación** — copia verbatim de `models/Simulacion.php` (líneas 70–180) con los 4 cambios mecánicos + `implements`; DELETE el método `predecir()` (vive en `ClienteMotorFlask`).
- [ ] **Step 3: Verificar sintaxis** — `php -l` como en fases anteriores.

### Task 13: Extraer la explicabilidad a Strategy (catálogo de explicadores)

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Dominio/ExplicadorInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Dominio/EvaluadorCondiciones.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Aplicacion/ResolutorContextoExplicacion.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Aplicacion/RegistroExplicadores.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Aplicacion/ServicioExplicabilidad.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Explicadores/*.php` (46 clases)

- [ ] **Step 1: Crear `ExplicadorInterface.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

interface ExplicadorInterface
{
    /** @param array<string, mixed> $contexto  @return list<array{titulo: string, tipo: string, contenido: string}> */
    public function construir(array $contexto): array;
}
```

- [ ] **Step 2: Crear `EvaluadorCondiciones.php`** (código completo; sustituye la cadena if/elseif de `strpos` preservando el orden del registro):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

final class EvaluadorCondiciones
{
    /**
     * Formatos soportados:
     *  ['cualquiera' => ['cascada','brecha']]      → algún strpos
     *  ['todas'      => ['probabilidad','cosecha']] → todos los strpos
     *  ['y' => [cond, cond]] / ['o' => [cond, cond]] → composición recursiva
     */
    public function cumple(array $condicion, string $nombreLower): bool
    {
        if (isset($condicion['cualquiera'])) {
            foreach ($condicion['cualquiera'] as $texto) {
                if (strpos($nombreLower, $texto) !== false) { return true; }
            }
            return false;
        }
        if (isset($condicion['todas'])) {
            foreach ($condicion['todas'] as $texto) {
                if (strpos($nombreLower, $texto) === false) { return false; }
            }
            return true;
        }
        if (isset($condicion['y'])) {
            foreach ($condicion['y'] as $sub) {
                if (!$this->cumple($sub, $nombreLower)) { return false; }
            }
            return true;
        }
        if (isset($condicion['o'])) {
            foreach ($condicion['o'] as $sub) {
                if ($this->cumple($sub, $nombreLower)) { return true; }
            }
            return false;
        }
        return false;
    }
}
```

- [ ] **Step 3: Crear `ResolutorContextoExplicacion.php`** — port del preprocesamiento de `explain()` (líneas 240–352): obtener cultivo y simulación por año, calcular datos derivados, normalizar `datos_grafico` (`$dg`), etc. Devuelve un array asociativo `$contexto` con TODAS las claves que los explicadores consumen (incluida `datos_grafico` y los valores ya formateados). Regla: los cálculos intermedios NO se alteran; solo se empaquetan.

- [ ] **Step 4: Crear `RegistroExplicadores.php`** — lista ORDENADA (el orden ES el contrato: mismo orden de evaluación que los if/elseif originales). Cada regla:

```php
[
    'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorCascada::class,
    'condicion'  => ['cualquiera' => ['cascada', 'brecha', 'limitante', 'contribuci']],
    'grafico'    => true,   // solo se evalúa si hay datos_grafico (bloque original líneas 350–426)
                     // si se omite, es regla de tarjeta (bloque 431+)
]
```

Tabla completa de reglas (todas de `SimulacionController::explain()`, commit `e89067d`; el orden de esta tabla ES el orden de evaluación):

| # | Clase (`Explicadores/`) | Condición (strpos, como array) | Línea origen | Grupo |
|---|---|---|---|---|
| 1 | `ExplicadorCascada` | cualquiera: cascada, brecha, limitante, contribuci | 354 | gráfico |
| 2 | `ExplicadorCurvaTemporal` | cualquiera: curva — **solo si `isset($dg['labels'])`** | 367 | gráfico |
| 3 | `ExplicadorDistribucionProbabilistica` | cualquiera: gauss, probabil, distribuc | 387 | gráfico |
| 4 | `ExplicadorSensibilidad` | cualquiera: sensibilidad | 412 | gráfico |
| 5 | `ExplicadorPotencialGenetico` | cualquiera: potencial, genético, genetico, límite genético | 434 | tarjeta |
| 6 | `ExplicadorRadiacionFotosintetica` | cualquiera: radiación, radiacion, par, fotosint | 445 | tarjeta |
| 7 | `ExplicadorRendimientoAlcanzable` | cualquiera: alcanzable | 456 | tarjeta |
| 8 | `ExplicadorCapacidadSuelo` | todas: capacidad, suelo | 467 | tarjeta |
| 9 | `ExplicadorAguaUtil` | cualquiera: agua, hídric, hidric, balance | 478 | tarjeta |
| 10 | `ExplicadorRendimientoPredicho` | cualquiera: predicho, estimado, cosecha esperada | 489 | tarjeta |
| 11 | `ExplicadorProbabilidadCosecha` | y: [cualquiera: probabilidad] + [cualquiera: cosecha, éxito, exito] | 502 | tarjeta |
| 12 | `ExplicadorIndiceCosecha` | cualquiera: índice de cosecha, indice de cosecha, harvest | 516 | tarjeta |
| 13 | `ExplicadorYieldGap` | cualquiera: gap, brecha | 527 | tarjeta |
| 14 | `ExplicadorPerdidaAgua` | y: [cualquiera: pérdida, perdida] + [cualquiera: agua, hídric, hidric] | 538 | tarjeta |
| 15 | `ExplicadorPerdidaNitrogeno` | y: [cualquiera: pérdida, perdida] + [cualquiera: nitrógeno, nitrogeno, n] (¡copiar condición literal!) | 549 | tarjeta |
| 16 | `ExplicadorLimitantePrincipal` | cualquiera: limitante, cuello | 560 | tarjeta |
| 17 | `ExplicadorAccionPrioritaria` | cualquiera: acción, accion, prioritaria, correctora | 571 | tarjeta |
| 18 | `ExplicadorFaseFenologica` | cualquiera: fase, fenológ, fenol, floración, floracion, emergencia, crecimiento, vegetativo, espigado | 582 | tarjeta |
| 19 | `ExplicadorROI` | cualquiera: roi, retorno | 594 | tarjeta |
| 20 | `ExplicadorMargenNeto` | cualquiera: margen, ganancia | 607 | tarjeta |
| 21 | `ExplicadorIngresoBruto` | cualquiera: ingreso | 620 | tarjeta |
| 22 | `ExplicadorCostoTotal` | cualquiera: costo, insumos | 631 | tarjeta |
| 23 | `ExplicadorBeneficioCosto` | cualquiera: beneficio, b-c | 642 | tarjeta |
| 24 | `ExplicadorPuntoEquilibrio` | cualquiera: equilibrio, break | 653 | tarjeta |
| 25 | `ExplicadorPrecioMinimo` | y: [cualquiera: precio] + [cualquiera: mínimo, minimo, piso] | 666 | tarjeta |
| 26 | `ExplicadorMargenSeguridad` | cualquiera: seguridad | 679 | tarjeta |
| 27 | `ExplicadorNivelConfianza` | cualquiera: confianza, monte carlo | 690 | tarjeta |
| 28 | `ExplicadorRiesgoFinanciero` | cualquiera: riesgo | 701 | tarjeta |
| 29 | `ExplicadorPerfilesProduccion` | cualquiera: perfiles, modelos de producción | 712 | tarjeta |
| 30 | `ExplicadorTIR` | cualquiera: tir, tasa interna | 723 | tarjeta |
| 31 | `ExplicadorGananciaPorDolar` | cualquiera: dólar, dolar | 734 | tarjeta |
| 32 | `ExplicadorENSO` | cualquiera: enso, niño, nino, oscilación | 746 | tarjeta |
| 33 | `ExplicadorLluviaPromedio` | cualquiera: lluvia — copiar la condición literal de la línea 757 | 757 | tarjeta |
| 34 | `ExplicadorAguaInicial` | copiar la condición literal de la línea 768 | 768 | tarjeta |
| 35 | `ExplicadorRiesgoEstacional` | cualquiera: riesgo estacional, compuesto, agronómico | 779 | tarjeta |
| 36 | `ExplicadorDesviacionMensual` | cualquiera: desviación, desviacion, anomalía | 790 | tarjeta |
| 37 | `ExplicadorAguaPorEstrato` | cualquiera: estrato | 801 | tarjeta |
| 38 | `ExplicadorRendimientoCentral` | cualquiera: central, esperado | 813 | tarjeta |
| 39 | `ExplicadorSuperarObjetivo` | cualquiera: superar — copiar condición literal de la línea 824 | 824 | tarjeta |
| 40 | `ExplicadorEstabilidad` | cualquiera: estabilidad | 835 | tarjeta |
| 41 | `ExplicadorFechaSiembra` | cualquiera: fecha, siembra — copiar condición literal de la línea 846 | 846 | tarjeta |
| 42 | `ExplicadorMesEspecifico` | copiar la condición literal de las líneas 857–866 ("mes de ...") | 857 | tarjeta |
| 43 | `ExplicadorComparadorHibridos` | cualquiera: comparador, híbridos, hibridos | 868 | tarjeta |
| 44 | `ExplicadorEstrategia` | cualquiera: estrategia | 879 | tarjeta |
| 45 | `ExplicadorGraficoGenerico` | cualquiera: gráfico, grafico, distribución, distribucion | 890 | tarjeta (última red antes del default) |
| 46 | `ExplicadorDefault` | (sin condición: fallback final si ninguna regla coincidió) | 900+ | tarjeta |

**IMPORTANTE — verificaciones al portar cada fila:**
1. Abrir la línea citada en `SimulacionController.php` y copiar la condición `strpos` LITERAL (las tablas anteriores son una transcripción; si hay discrepancia, gana el archivo original).
2. El nombre se normaliza UNA vez, igual que hoy; si el original usa `strtolower(...)`, usar exactamente la misma función (no `mb_strtolower` si el original no la usa).
3. Copiar el contenido (títulos `1. ...`, `'tipo' => 'info'|'success'|'warning'...`, interpolaciones `$variable`) SIN tocar ni un carácter.
4. Cada explicador devuelve las `$secciones` y NO arma la respuesta final (eso es del servicio, líneas 913–929 verbatim).

- [ ] **Step 5: Crear `ServicioExplicabilidad.php`** — orquestador:

```php
public function explicar(array $contextoBruto): array
{
    $contexto    = $this->resolutor->construir($contextoBruto);
    $nombreLower = /* misma normalización del original */;
    $secciones   = [];

    foreach ($this->registro->reglas() as $regla) {
        if (($regla['grafico'] ?? false) && !isset($contexto['datos_grafico'])) {
            continue; // paridad: el bloque gráfico original solo corre con datos_grafico
        }
        if (isset($regla['extra']) && !($regla['extra'])($contexto)) {
            continue; // p. ej. ExplicadorCurvaTemporal exige $dg['labels']
        }
        if (!$this->evaluador->cumple($regla['condicion'], $nombreLower)) {
            continue;
        }
        $clase     = $regla['explicador'];
        $secciones = (new $clase())->construir($contexto);
        break; // primer match gana, igual que if/elseif
    }

    // Ensamblado final VERBATIM de líneas 913–929 (mismas claves: titulo, explicacion_breve,
    // impacto_en_el_cultivo, nivel, recomendacion, alerta, offline).
    return [...];
}
```

- [ ] **Step 6: Prueba focalizada de estrategias** (antes de tocar rutas). Ejecutar 6 explicaciones distintas con `curl` contra el sistema ACTUAL y guardarlas; repetir TRAS el switch (Task 15) y comparar a ojo las más distintas: cascada (gráfico), ROI (financiera), probabilidad (probabilística), fecha siembra (temporal), riesgo estacional (compuesta), y una inventada (default). La suite cubre 3 de ellas automáticamente.

### Task 14: SimulacionService + controller + switch final del dominio

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Aplicacion/SimulacionService.php`
- Create: `backend-api/src/Dominios/Simulaciones/Http/SimulacionController.php`
- Modify: `contenedor.php`, `rutas.php`, `public/index.php`
- Delete: `backend-api/controllers/SimulacionController.php`, `backend-api/models/Simulacion.php`, `backend-api/models/Cultivo.php` (si quedó), `backend-api/helpers/IaServerHelper.php`

- [ ] **Step 1: `SimulacionService.php`** — port de `SimulacionController` con inyección (`SimulacionRepositoryInterface`, `MotorPrediccionInterface`, `GestorMotorIaInterface`, `ServicioExplicabilidad`, `CacheInterface`, `CultivoRepositoryInterface` para validar pertenencia del lote):

| Método | Origen | Notas |
|---|---|---|
| `simular(int $usuarioId, Peticion $p): array` | `simular()` 54–164 | `IaServerHelper::ensureRunning()` → `$this->motorIa->asegurarActivo()`; `$this->simulacion->predecir()` → `$this->motor->predecir()`; mensajes exactos (400s, 403, 503, 502, 500) |
| `historial(int $usuarioId, Peticion $p): array` | `historial()` 166–181 | `limpiarCacheExpirada()` → `$this->cache->limpiarExpirados()` |
| `eliminar(int $usuarioId, Peticion $p): array` | `eliminar()` 183–211 | — |
| `iaStatus(Peticion $p): array` | `iaStatus()` 213–221 | `IaServerHelper::getStatus($tryStart)` → `$this->motorIa->estado($tryStart)` |
| `explain(int $usuarioId, Peticion $p): array` | `explain()` 223–929 | validaciones 225–238 + `$this->explicabilidad->explicar($contexto)`; conservar `set_time_limit(240)` |

- [ ] **Step 2: `SimulacionController.php` nuevo** — 5 métodos ultra-delgados: delegar en `RespuestaJson::enviar($this->servicio->metodo(...))`; `simular`, `historial`, `eliminar` y `explain` pasan `$this->usuarioId()` (mismo helper privado que CultivoController); `iaStatus` solo pasa `$peticion`.
- [ ] **Step 3: Bindings + rutas + limpieza**: como en fases previas para las 5 rutas de simulaciones; `git rm` de los 4 archivos legacy. Verificar `rg -n "IaServerHelper|models/Simulacion|models/Cultivo" backend-api --glob "!tests/**"` → sin coincidencias.
- [ ] **Step 4: Verificación de la puerta F04 + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==`. Además comparar a mano las 6 explicaciones del punto Task 13 Step 6.

```bash
git add -A backend-api
git commit -m "refactor(simulaciones): dominio Simulaciones con motor IA inyectado y explicabilidad por estrategias (46 explicadores)"
```

---

## Fase F05 — Dominio Analítica DSS (4 dashboards)

> **Puerta de salida:** `CONTRATO OK` con los 4 dashboards migrados y controladores delgados.

### Task 15: Catálogo agronómico + servicio/controlador de rendimiento (Yield)

**Files:**
- Create: `backend-api/src/Dominios/Analitica/Dominio/CatalogoAgronomicoInterface.php`
- Create: `backend-api/src/Dominios/Analitica/Infraestructura/RepositorioCatalogoAgronomico.php`
- Create: `backend-api/src/Dominios/Analitica/Aplicacion/ServicioAnaliticaYield.php`
- Create: `backend-api/src/Dominios/Analitica/Http/YieldController.php`

- [ ] **Step 1: `CatalogoAgronomicoInterface`**: `cargar(): array` (lee `agronomia_data.json`; localizar ruta real con `rg -n "agronomia_data" backend-api`). Implementación con cache en memoria por request (estático). **Los 4 dashboards la compartirán** (antes cada controlador lo releía).
- [ ] **Step 2: `ServicioAnaliticaYield.php`** — mover el cuerpo completo de `YieldController::index()` (líneas 28–final, commit `e89067d`) a `construir(?int $cultivoId, ?int $anio): array`; los `echo json_encode([...])` finales → `return [...]`. Dependencias inyectadas: `CultivoRepositoryInterface`, `SimulacionRepositoryInterface`, `CatalogoAgronomicoInterface`. **NO tocar la lógica del `mt_rand` (comportamiento actual; la comparación es tolerante).**
- [ ] **Step 3: `YieldController.php` nuevo** (delgado):

```php
final class YieldController
{
    public function __construct(private ServicioAnaliticaYield $servicio) {}

    public function index(Peticion $peticion): void
    {
        // Semántica EXACTA del original: isset($_GET[x]) && $_GET[x] !== '' ? intval : null
        $cultivoId = $peticion->query('cultivo_id');
        $anio      = $peticion->query('anio');

        RespuestaJson::enviar($this->servicio->construir(
            ($cultivoId !== null && $cultivoId !== '') ? (int) $cultivoId : null,
            ($anio !== null && $anio !== '') ? (int) $anio : null,
        ));
    }
}
```

(Conservar la semántica exacta de `$_GET['anio'] !== ''` del original para cada param.)

### Task 16: Servicios/controladores de Scenario y Financial

- [ ] **Step 1:** `ServicioAnaliticaScenario::construir(?int $cultivoId, ?int $anio): array` — cuerpo de `ScenarioController::index()` (líneas 28–final). Dependencias: igual que Yield.
- [ ] **Step 2:** `ServicioAnaliticaFinancial` — cuerpo de `FinancialController::index()` (líneas 28–final); conservar TODOS los `$_GET` (`precio_maiz_qq`, `rendimiento_qq`, `costo_semilla`, `costo_fert`, `costo_riego`, `costo_proteccion`, `otros_var`, `costos_variables`, `costos_fijos`) — la firma del servicio recibe la `Peticion` completa: `construir(Peticion $p): array`.
- [ ] **Step 3:** Controladores delgados `ScenarioController` y `FinancialController` (patrón Yield).

### Task 17: Servicio/controlador de Climate + switch final + limpieza

- [ ] **Step 1:** `ServicioAnaliticaClimate::construir(?int $cultivoId, ?int $anio): array` — cuerpo de `ClimateController::index()` (líneas 231–final). Dependencias: `CultivoRepositoryInterface`, `SimulacionRepositoryInterface`, `ServicioDatosTerreno` (sustituye la llamada interna a `consultarDatosApiPrecision`). Conservar la limpieza de caché si el original la invoca.
- [ ] **Step 2:** Controlador delgado `ClimateController` nuevo.
- [ ] **Step 3: Bindings + rutas + limpieza**: `rutas.php` para las 4 rutas DSS → controladores de `ZeaSys\Dominios\Analitica\Http\...`; bindings de los 4 servicios + catálogo; `git rm` de los 4 controladores legacy (`ScenarioController.php`, `ClimateController.php`, `YieldController.php`, `FinancialController.php`); quitar sus `require_once` de `index.php`.
- [ ] **Step 4: Verificación de la puerta F05 + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` (los 4 dashboards; yield/financial tolerantes, climate estructural).

```bash
git add -A backend-api
git commit -m "refactor(analitica): dashboards DSS como servicios con catalogo compartido y controladores delgados"
```

---

## Fase F06 — Limpieza, documentación y verificación integral

### Task 18: Limpieza total de la estructura legacy

- [ ] **Step 1: Verificar que no queda ningún consumidor legacy**

```powershell
rg -n "require_once.*(controllers|models|helpers)" backend-api --glob "!tests/**" --glob "!src/**"
rg -n "config/(database|google)" backend-api --glob "!tests/**"
rg -n "new (AuthController|CultivoController|SimulacionController|ScenarioController|ClimateController|YieldController|FinancialController)\(" backend-api --glob "!tests/**"
```
Expected: sin coincidencias (salvo `index.legacy.php.txt`, que se borra en el paso siguiente).

- [ ] **Step 2: Eliminar shims y residuos**

```powershell
git rm backend-api/public/index.legacy.php.txt backend-api/config/database.php
# Solo si quedó el shim de google:
git rm backend-api/config/google.php
```
Vaciar/eliminar `backend-api/controllers/`, `backend-api/models/`, `backend-api/helpers/` y `backend-api/config/` si quedaron vacíos (`git status` lo confirmará).

- [ ] **Step 3: Confirmar `index.php` final** — debe quedar SIN ningún `require_once` de controladores (solo autoloader + config), y el directorio `backend-api/` debe verse así:

```
backend-api/
├── public/index.php            ← bootstrap ~45 líneas
├── src/
│   ├── Kernel/                 ← Autoloader, Router, Container, Peticion, RespuestaJson, Cors,
│   │   └── Errores/            ←   Middleware, excepciones tipadas + ManejadorErrores
│   ├── Config/                 ← aplicacion.php, constantes_negocio.php, google.php, rutas.php, contenedor.php
│   └── Dominios/
│       ├── Autenticacion/      ← Dominio/ Infraestructura/ Aplicacion/ Http/
│       ├── Lotes/
│       ├── Terreno/
│       ├── Simulaciones/       ← + Explicacion/ (46 explicadores)
│       └── Analitica/
├── data/ · uploads/ · tests/   ← sin cambios
```

- [ ] **Step 4: Verificación final de la suite + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==`

```bash
git add -A
git commit -m "refactor(backend): eliminacion de estructura legacy, shims y archivos temporales"
```

### Task 19: Documentación (arquitectura + 7 ADRs)

- [ ] **Step 1: Reescribir `documentacion/arquitectura.md`** con: (a) diagrama ASCII de los 5 dominios y sus 4 capas (regla de dependencia: Http → Aplicación → Dominio ← Infraestructura); (b) tabla ruta → controlador → servicio → repositorio/interfaz; (c) flujo de una petición (index.php → Router → Middleware → Container → Controller → Service → Repo); (d) cómo agregar un indicador DSS nuevo (crear explicador + registrarlo); (e) cómo agregar una ruta; (f) comandos de la suite de contrato; (g) mapa de bindings del contenedor.
- [ ] **Step 2: Crear los 7 ADRs en `documentacion/adr/`** (formato: Título, Estado, Contexto, Decisión, Consecuencias; 25–40 líneas cada uno):
  - `ADR-001-microservicios-logicos.md`: por qué dominios lógicos sobre XAMPP y no servicios físicos (restricción obligatoria, costo operativo, mismo repositorio, límites de dominio claros, camino de migración futura).
  - `ADR-002-kernel-sin-framework.md`: autoloader PSR-4 manual, sin Composer ni framework (contexto XAMPP/portabilidad, ~15 clases propias, fuente del routing/DI).
  - `ADR-003-router-declarativo.md`: tabla `rutas.php` como única fuente de verdad; orden middleware→método; extensión futura a parámetros de ruta; por qué `acciones` para `api/cultivos`.
  - `ADR-004-contratos-congelados-y-suite-de-contrato.md`: política de no cambiar rutas/payloads durante la migración; diseño de la suite (normalización de volátiles, tolerancias, estructural para APIs externas); control negativo; exit codes.
  - `ADR-005-strategy-para-explicabilidad.md`: 46 explicadores + registro ordenado; el orden de matching es contrato; beneficios (nuevo indicador = 1 clase + 1 fila) y riesgos (regresiones de orden → cubiertas por la suite).
  - `ADR-006-contenedor-di-manual.md`: fábricas explícitas sin autowiring; singletons por request; trade-offs vs contenedor con reflexión.
  - `ADR-007-deuda-tecnica-aceptada.md`: ALTERs de `asegurarColumnasPerfil()` en cada request (se conserva por paridad), `mt_rand` en pérdidas por fecha de siembra, uploads de avatar sin limpieza de archivos, rutas sin parámetros dinámicos, sin rate-limiting.
- [ ] **Step 3: Commit de documentación**

```bash
git add documentacion
git commit -m "docs(arquitectura): estructura de dominios, guia de extension y 7 ADRs de la reestructuracion"
```

### Task 20: Verificación integral final (puerta de cierre)

- [ ] **Step 1: Suite completa de contrato** → `== CONTRATO OK: sin diferencias ==` (exit 0).
- [ ] **Step 2: Control negativo nuevamente** (la red de seguridad sigue viva): repetir Task 2 Steps 1–3 → debe FALLAR con la huella dañada.
- [ ] **Step 3: Smoke test manual del sistema completo** (lo ejecuta el usuario desde el navegador, con checklist):
  1. Frontend en `http://localhost:5173` carga el login.
  2. Registro de un usuario nuevo y login.
  3. Crear lote con ubicación en mapa (coordenadas dentro de Ecuador).
  4. Correr una simulación y ver resultado + guardado en historial.
  5. Dashboards: Rendimiento, Escenarios, Clima, Financiero (con datos del lote).
  6. Explicar un indicador del dashboard (varias tarjetas distintas).
  7. Editar perfil, subir avatar, cerrar sesión.
- [ ] **Step 4: Tag final y cierre**

```bash
git tag v1.0-reestructurado
git log --oneline -15
```
Expected: se ven los commits por fase (F00–F06) sobre `e89067d`.

- [ ] **Step 5: Informe final al usuario** — resumen de: estructura nueva, fases completadas, resultado de la suite, ADRs, deuda técnica registrada, y siguiente paso (subproyecto 2: chatbot sobre `documentacion/` + explicadores).

---

## Autocontrol del plan (ejecutado al escribirlo)

> Este bloque documenta la revisión del propio plan antes de entregarlo (writing-plans: "self-review").

1. **Cobertura del spec**: todos los puntos del diseño aprobado tienen tarea — 5 dominios (F02–F05), kernel (F01), DIP de `Simulacion` y `CultivoController` (F03–F04), Strategy de `explain()` (F04), errores tipados (F01), verificación antes/después (F00+puertas), docs/ADRs (F06).
2. **Sin placeholders**: todo lo nuevo con código completo; lo portado con origen exacto (archivo + líneas del commit `e89067d`) y reglas mecánicas.
3. **Consistencia de nombres**: `Container` (no Contenedor), `Peticion`, `RespuestaJson`, `ZeaSys\Kernel\Errores\*`, `ZeaSys\Dominios\<Dominio>\{Dominio,Infraestructura,Aplicacion,Http}` — verificada entre fases.
4. **Puntos de riesgo identificados**: orden del registro de explicadores (contrato), `acciones` por método en `api/cultivos` (única ruta con gate de método), `session_write_close` selectivo (const lista), doble `delete-avatar` en la suite (estable), `SESSION_NAME` (definida en `aplicacion.php`).
5. **Cada fase termina en**: suite de contrato OK + commit. Ninguna fase se cierra sin eso.


