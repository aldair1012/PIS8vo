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
const BAT_IA    = __DIR__ . '/../../../auto_ia_server.bat';

// Temporales de la corrida (cookies, PNG): se borran siempre, incluso con exit().
$temporalesSuite = [];
register_shutdown_function(static function () use (&$temporalesSuite): void {
    foreach ($temporalesSuite as $archivo) {
        if (is_string($archivo) && is_file($archivo)) { @unlink($archivo); }
    }
});

$opciones = getopt('', ['modo::', 'destino::', 'tolerancia::']);
$modo     = $opciones['modo'] ?? null;
if ($modo === null || !in_array($modo, ['capturar', 'comparar'], true)) {
    fail('Uso: php tests/contrato/ejecutar.php --modo=capturar|comparar [--destino=snapshots/antes/contrato.json] [--tolerancia=25]');
    exit(2);
}

$dirBase = __DIR__;
$destino = $opciones['destino'] ?? ($dirBase . '/snapshots/antes/contrato.json');
if (!preg_match('~^([A-Za-z]:)?[\\\\/]~', (string) $destino)) {
    $destino = $dirBase . '/' . $destino;
}

$tolerancia = 25.0;
if (array_key_exists('tolerancia', $opciones)) {
    if (!is_numeric($opciones['tolerancia'])) {
        fail('[X] --tolerancia debe ser numérica (recibido: ' . $opciones['tolerancia'] . ')');
        exit(2);
    }
    $tolerancia = (float) $opciones['tolerancia'];
}

// ---------------------------------------------------------------- utilidades

function say(string $texto): void { fwrite(STDOUT, $texto . PHP_EOL); }
function fail(string $texto): void { fwrite(STDERR, $texto . PHP_EOL); }

/** Un chequeo de salud del motor IA (true si responde 200). */
function saludarMotor(): bool
{
    $ch = curl_init(IA_HEALTH);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 3, CURLOPT_CONNECTTIMEOUT => 2]);
    curl_exec($ch);
    $ok = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    return $ok;
}

function asegurarFlask(): bool
{
    if (saludarMotor()) { return true; }

    say('[*] Motor IA apagado; intentando arrancar con auto_ia_server.bat ...');
    if (PHP_OS_FAMILY === 'Windows' && file_exists(BAT_IA)) {
        pclose(popen('start /B "" "' . BAT_IA . '"', 'r'));
    }
    for ($i = 0; $i < 25; $i++) {
        sleep(1);
        if (saludarMotor()) { return true; }
    }
    return false;
}

function normalizarString(string $valor): string
{
    $valor = preg_replace('/contrato_\d+@/', 'contrato_<ts>@', $valor);
    $valor = preg_replace('/Simulación \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/u', 'Simulación <fecha>', $valor);
    $valor = preg_replace('/\d{2}\/\d{2}\/\d{4}/', '<fecha>', $valor);
    $valor = preg_replace('/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/', '<fecha>', $valor);
    $valor = preg_replace('/avatar_\d+_[a-f0-9]+\./i', 'avatar_<ts>.', $valor);
    return $valor;
}

/** Normaliza claves volátiles (ids, fechas, aleatorios, datos externos) para que la huella sea comparable. */
function normalizar(mixed $valor): mixed
{
    if (is_array($valor)) {
        // Ítems aleatorios (mt_rand en YieldController): {name|factor: '...Fecha de Siembra...', value/porcentaje}
        $etiquetaAleatoria = $valor['name'] ?? $valor['factor'] ?? null; // waterfall_losses usa 'name'; factores_contribucion usa 'factor'
        $esItemAleatorio = is_string($etiquetaAleatoria)
            && stripos($etiquetaAleatoria, 'fecha') !== false
            && stripos($etiquetaAleatoria, 'siembra') !== false;

        $salida = [];
        foreach ($valor as $clave => $sub) {
            if (is_string($clave) && in_array($clave, ['rendimiento_estimado', 'produccion_total', 'rendimiento_promedio', 'mejor_rendimiento', 'peor_rendimiento', 'rendimiento_maximo', 'rendimiento_minimo', 'shap_json', 'escenarios_json', 'prediccion_json'], true)) {
                // Salidas derivadas del motor ML (soilgrids flaky): comparar solo el TIPO de dato
                $salida[$clave] = '<externo:' . gettype($sub) . '>';
                continue;
            }
            if ($esItemAleatorio && is_string($clave) && in_array($clave, ['value', 'porcentaje'], true) && !is_array($sub)) {
                $salida[$clave] = '<volatil>';
                continue;
            }
            if (is_string($clave) && in_array(strtolower($clave), ['soilgrids', 'open_meteo', 'openmeteo'], true)) {
                $salida[$clave] = '<externo>'; // datos externos en vivo: no comparar (null/array son ambos válidos)
                continue;
            }
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
        if ($esLista) { $salida[$prefijo . '/{count}'] = 'number:' . count($valor); }
        foreach ($valor as $clave => $sub) {
            $hijo = $esLista ? $prefijo . '/*' : $prefijo . '/' . $clave;
            $salida = array_merge($salida, estructura($sub, $hijo));
        }
        return $salida;
    }
    return [$prefijo => etiquetaTipo($valor)];
}

/** Compara recursivamente esperado vs obtenido. `estructural` nunca llega aquí (se compara con `estructura()` + exacto). */
function comparar(mixed $esperado, mixed $obtenido, string $ruta, string $modo, float $tolerancia, array &$diferencias): void
{
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
    $familiaA = etiquetaTipo($esperado);
    $familiaB = etiquetaTipo($obtenido);
    if ($familiaA !== $familiaB) {
        $diferencias[] = "$ruta: tipo distinto (antes $familiaA, ahora $familiaB)";
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
    if (is_string($esperado) && is_string($obtenido) && $esperado !== $obtenido && $modo === 'tolerante') {
        // Modo tolerante: comparar esqueleto (números → '#') y cada número con ±tolerancia
        $patron = '/\d+(?:\.\d+)?/';
        preg_match_all($patron, $esperado, $numsA);
        preg_match_all($patron, $obtenido, $numsB);
        $esqueletoA = preg_replace($patron, '#', $esperado);
        $esqueletoB = preg_replace($patron, '#', $obtenido);

        if ($esqueletoA !== $esqueletoB || count($numsA[0]) !== count($numsB[0])) {
            $diferencias[] = "$ruta: texto distinto (antes " . json_encode($esperado, JSON_UNESCAPED_UNICODE) . ', ahora ' . json_encode($obtenido, JSON_UNESCAPED_UNICODE) . ')';
            return;
        }

        foreach ($numsA[0] as $i => $textoA) {
            $a    = (float) $textoA;
            $b    = (float) $numsB[0][$i];
            $base = max(abs($a), abs($b), 1.0);
            if (abs($a - $b) / $base * 100 > $tolerancia) {
                $diferencias[] = "$ruta: número dentro de texto fuera de tolerancia (antes $textoA, ahora {$numsB[0][$i]})";
                return;
            }
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
        return $this->capturarRespuesta($ch);
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
        return $this->capturarRespuesta($ch);
    }

    /** Ejecuta el handle y normaliza la respuesta a http/cuerpo/curl_error. */
    private function capturarRespuesta(\CurlHandle $ch): array
    {
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

function ejecutarEscenario(string $modo, array &$temporales): array
{
    $cookieJar = sys_get_temp_dir() . '/zeasys_contrato_cookies_' . uniqid() . '.txt';
    $temporales[] = $cookieJar;
    $cliente   = new ClienteHttp($cookieJar);
    $email     = 'contrato_' . time() . '@zeasys.local';
    $password  = 'Contrato123!';
    $pasos     = [];
    $ids       = ['cultivo' => null, 'simulacion' => null];

    // PNG 1x1 válido para la prueba de subida de avatar
    $tmpPng = sys_get_temp_dir() . '/zeasys_contrato_avatar_' . uniqid() . '.png';
    $temporales[] = $tmpPng;
    file_put_contents($tmpPng, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));

    $registrar = function (string $nombre, string $metodo, string $ruta, ?array $cuerpo, string $volatilidad, bool $multipart = false) use (&$pasos, $cliente, $modo): array {
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
        if ($modo === 'capturar') {
            if ($r['curl_error'] !== null) {
                fail("Paso '$nombre': error de curl: {$r['curl_error']}");
                exit(2);
            }
            if ($r['http'] >= 500) {
                fail("Paso '$nombre': HTTP {$r['http']} — estado del servidor, la huella quedaría envenenada");
                exit(2);
            }
            if ($r['http'] >= 400) {
                say("[!] Paso '$nombre': HTTP {$r['http']} — advertencia: se captura igual (puede ser un 4xx esperado del contrato)");
            }
        }
        if ($r['curl_error'] !== null) {
            fail("    curl_error en [$nombre]: {$r['curl_error']}");
        }
        return $r;
    };

    // 1) Salud del sistema
    $registrar('ia-status requiere autenticacion', 'GET', '/api/simulaciones/ia-status', null, 'exacto');

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

    // 5b) Chatbot (paso 30): pregunta por un indicador conocido y verifica respuesta
    $registrar('chat responde indicador', 'POST', '/api/chat/preguntar', [
        'pregunta' => '¿Qué significa mi ROI?',
        'vista' => 'dashboard-financial',
    ], 'tolerante');

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

    return $pasos;
}

// ---------------------------------------------------------------- main

say('== ZeaSys · Suite de contrato ==  modo: ' . $modo);

if (!asegurarFlask()) {
    fail('[X] El motor IA no responde en ' . IA_HEALTH . '. Encienda XAMPP/Flask e intente de nuevo.');
    exit(2);
}

$pasosNuevos = ejecutarEscenario($modo, $temporalesSuite);
say('[*] Pasos ejecutados: ' . count($pasosNuevos));

if ($modo === 'capturar') {
    $dirHuella = dirname($destino);
    if (!is_dir($dirHuella) && !mkdir($dirHuella, 0777, true)) {
        fail('[X] No se pudo crear el directorio de la huella: ' . $dirHuella);
        exit(2);
    }
    $jsonHuella = json_encode([
        'fecha_captura' => date('c'),
        'base_url'      => BASE_URL,
        'tolerancia'    => $tolerancia,
        'pasos'         => $pasosNuevos,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($jsonHuella === false || file_put_contents($destino, $jsonHuella) === false) {
        fail('[X] No se pudo escribir la huella en: ' . $destino);
        exit(2);
    }
    say('[OK] Huella capturada en: ' . $destino);
    exit(0);
}

if ($modo === 'comparar') {
    if (!is_file($destino)) {
        fail('[X] No existe la huella de referencia: ' . $destino);
        exit(2);
    }
    $referencia = json_decode((string) file_get_contents($destino), true);
    if (!is_array($referencia) || !is_array($referencia['pasos'] ?? null)) {
        fail('[X] Huella de referencia ilegible/corrupta: ' . $destino);
        exit(2);
    }
    if (isset($referencia['tolerancia']) && (float) $referencia['tolerancia'] !== $tolerancia) {
        fail('[!] Tolerancia distinta a la de la referencia: antes ' . $referencia['tolerancia'] . ', ahora ' . $tolerancia);
    }
    $pasosA = $referencia['pasos'];
    $total  = 0;

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
        if (($pasoA['volatilidad'] ?? null) !== ($pasoB['volatilidad'] ?? null)) {
            $diferencias[] = "paso '{$pasoA['nombre']}': volatilidad cambió (antes " . ($pasoA['volatilidad'] ?? '?') . ', ahora ' . ($pasoB['volatilidad'] ?? '?') . ')';
        }
        $modoPaso = $pasoA['volatilidad']; // la de la referencia manda en la evaluación
        if ($modoPaso === 'estructural') {
            $estructuraA = estructura($pasoA['cuerpo']);
            $estructuraB = estructura($pasoB['cuerpo']);
            comparar($estructuraA, $estructuraB, 'estructura', 'exacto', $tolerancia, $diferencias);
        } else {
            comparar($pasoA['cuerpo'], $pasoB['cuerpo'], 'cuerpo', $modoPaso, $tolerancia, $diferencias);
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
