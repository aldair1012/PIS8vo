<?php
declare(strict_types=1);
namespace ZeaSys\Tests\ClimaEvidencia;
require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
\ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Dominios\Terreno\Infraestructura\ProveedorNoaaOni;
use ZeaSys\Dominios\Terreno\Infraestructura\ProveedorOpenMeteo;
use ZeaSys\Dominios\Chat\Aplicacion\ContextoAgricolaService;
use ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise;
final class Cache implements CacheInterface {
    public array $data = [];
    public function obtener(string $clave, int $ttlSegundos = 86400): ?array { return $this->data[$clave] ?? null; }
    public function guardar(string $clave, array $valor): void { $this->data[$clave] = $valor; }
    public function limpiarExpirados(): void {}
}
$passed = 0;
function check(bool $condition, string $name): void { global $passed; if (!$condition) throw new \RuntimeException($name); echo "[OK] $name\n"; $passed++; }
function callPrivate(object $object, string $method, mixed ...$args): mixed { return (new \ReflectionMethod($object, $method))->invoke($object, ...$args); }
$clock = new \DateTimeImmutable('2026-11-15T12:00:00Z');
$provider = new ProveedorNoaaOni(new Cache(), null, $clock);
$raw = "SEAS YR ANOM\nMAM 2026 -0.04\nAMJ 2026 .49\nMJJ 2026 .97\nJJA 2026 1.36\nJAS 2026 1.69\nASO 2026 1.97\nSON 2026 2.0\nOND 2026 -99.9\n";
$series = callPrivate($provider, 'parsear', $raw);
check(count($series) === 6 && end($series)['indice'] === 'RONI', 'RONI de tres columnas no se confunde con ONI; se excluyen períodos futuros y centinelas');
$file = tempnam(sys_get_temp_dir(), 'zeasys_roni_');
try {
    file_put_contents($file, $raw);
    $cache = new Cache();
    $result = (new ProveedorNoaaOni($cache, 'file:///' . str_replace('\\', '/', $file), $clock))->obtenerOni();
    check($result['valor_indice'] === 1.97 && $result['oni'] === null && $result['roni'] === 1.97, 'el proveedor respeta la URL inyectada y conserva la identidad del índice');
    check($result['consecutivos'] === 4 && !$result['episodio_declarado'], 'una anomalía cálida no se presenta como episodio oficial declarado');
    check($result['vigente'] && $result['fin_periodo'] === '2026-10-31', 'se conserva el fin real del trimestre informado');
    $cached = (new ProveedorNoaaOni($cache, null, $clock->modify('+1 year')))->obtenerOni();
    check($cached['desde_cache'] && !$cached['vigente'], 'una referencia antigua en caché se identifica como histórica');
    file_put_contents($file, str_replace('AMJ 2026 .49', 'AMJ 2026 0.6', str_replace('JJA 2026 1.36', 'FMA 2026 1.0', $raw)));
    $gapped = (new ProveedorNoaaOni(new Cache(), 'file:///' . str_replace('\\', '/', $file), $clock))->obtenerOni();
    check($gapped['consecutivos'] === 2 && !$gapped['criterio_historico_cumplido'], 'un hueco temporal interrumpe los períodos consecutivos de ENSO');
} finally { unlink($file); }
$archive = new ProveedorOpenMeteo();
$dates = array_map(static fn (int $day): string => sprintf('2026-10-%02d', $day), range(1, 31));
$daily = ['time' => $dates, 'precipitation_sum' => array_fill(0, 31, 0), 'temperature_2m_mean' => array_fill(0, 31, 25)];
$summary = callPrivate($archive, 'resumirMeses', $daily, '2026-10-01', '2026-10-31');
check($summary['meses'][0]['precipitacion_mm'] === 0.0 && $summary['meses'][0]['dias_lluvia'] === 31, 'un mes completo sin lluvia conserva cero real');
$daily['precipitation_sum'][4] = null;
$summary = callPrivate($archive, 'resumirMeses', $daily, '2026-10-01', '2026-10-31');
check($summary['meses'][0]['precipitacion_mm'] === null && $summary['meses'][0]['dias_lluvia'] === 30, 'un día sin lluvia informada invalida el total mensual en lugar de sumarlo como cero');
$daily['time'][] = '2026-10-01'; $daily['precipitation_sum'][] = 9000;
$summary = callPrivate($archive, 'resumirMeses', $daily, '2026-10-01', '2026-10-31');
check($summary['meses'][0]['dias'] === 31 && $summary['meses'][0]['precipitacion_mm'] === null, 'fechas duplicadas no inflan días ni lluvia');
$context = (new \ReflectionClass(ContextoAgricolaService::class))->newInstanceWithoutConstructor();
$forecast = array_map(static fn (int $day): array => ['fecha' => "2026-11-$day", 'precipitacion_mm' => 0, 'prob_precipitacion_pct' => 80, 'temp_max_c' => 30], range(15, 21));
$compacted = callPrivate($context, 'compactarClima', ['pronostico_7d' => $forecast]);
check($compacted['resumen_7d']['lluvia_total_mm'] === 0.0 && $compacted['resumen_7d']['dias_con_lluvia'] === 0, 'la probabilidad no se suma como lluvia ni como daño agrícola en el contexto del chat');
$forecast[3]['precipitacion_mm'] = null;
$compacted = callPrivate($context, 'compactarClima', ['pronostico_7d' => $forecast]);
check($compacted['resumen_7d']['lluvia_total_mm'] === null && $compacted['resumen_7d']['dias_con_lluvia_informada'] === 6, 'el chat sabe que falta un dato semanal');
$gemini = (new \ReflectionClass(GeminiFlowise::class))->newInstanceWithoutConstructor();
$prompt = callPrivate($gemini, 'compactarContextoParaConsulta', ['panel_actual' => 'climate', 'contexto_agricola' => ['clima' => $compacted]], 'Explícame el pronóstico');
$payload = json_decode($prompt, true, 512, JSON_THROW_ON_ERROR);
check(count($payload['clima_detalle']['pronostico_7d']) === 7 && str_contains($payload['clima_detalle']['pronostico_7d'][6], '2026-11-21'), 'los siete días llegan a Gemini sin perder las últimas fechas por el limitador de profundidad');
$record = ['datos' => ['etapa' => 'V2-V8', 'fecha_observacion' => '2026-11-15'], 'indicadores' => []];
$yield = callPrivate($context, 'compactarRendimiento', ['sin_datos' => true, 'mediciones_campo' => $record]);
check($yield['mediciones_campo']['datos']['etapa'] === 'V2-V8', 'las observaciones del productor se conservan aunque no haya simulación');
$payload = json_decode(callPrivate($gemini, 'compactarContextoParaConsulta', ['panel_actual' => 'climate', 'contexto_agricola' => ['clima' => $compacted, 'rendimiento' => $yield]], '¿Qué etapa observé?'), true, 512, JSON_THROW_ON_ERROR);
check($payload['registro_campo_actual']['etapa'] === 'V2-V8' && $payload['registro_campo_actual']['fecha_observacion'] === '2026-11-15', 'la etapa observada y su fecha llegan a Gemini desde el servidor');
$history = array_map(static fn (int $day): string => json_encode(['fecha' => sprintf('2026-10-%02d', $day), 'precip_mm' => $day, 'et0_mm' => 2, 'temp_media_c' => 25]), range(1, 30));
$longClimate = $compacted + ['historial_30d' => $history];
$longClimate['historial_30d'] = $history;
$longPrompt = callPrivate($gemini, 'compactarContextoParaConsulta', ['panel_actual' => 'climate', 'contexto_agricola' => ['clima' => $longClimate]], 'Explícame el historial de los últimos 30 días');
$longPayload = json_decode($longPrompt, true, 512, JSON_THROW_ON_ERROR);
check(count($longPayload['clima_detalle']['historial']) === 30 && mb_strlen($longPrompt) <= 6400, 'la explicación del historial conserva treinta días dentro del presupuesto de contexto');
echo "$passed passed, 0 failed\n";
