<?php
// Read-only provider check with a public reference coordinate; no accounts, plots or personal DB.
declare(strict_types=1);
require_once __DIR__ . '/../backend-api/src/Kernel/AutoloaderPsr4.php';
\ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../backend-api/src');
use ZeaSys\Dominios\Terreno\Infraestructura\ProveedorOpenMeteoForecast;
use ZeaSys\Dominios\Terreno\Infraestructura\ProveedorOpenMeteo;
use ZeaSys\Dominios\Terreno\Infraestructura\ProveedorNoaaOni;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
$report = ['consultado_utc' => gmdate('c'), 'coordenada_referencia_publica' => [-1.05, -80.45], 'nota' => 'Diagnóstico de conectividad: no se guarda como dato de una parcela.'];
try {
    $forecast = (new ProveedorOpenMeteoForecast())->obtenerClimaActual(-1.05, -80.45);
    $report['pronostico'] = ['disponible' => $forecast['disponible'], 'fecha' => $forecast['actual']['fecha_hora'] ?? null, 'dias' => count($forecast['pronostico_7d'] ?? []), 'humedad_suelo' => $forecast['actual']['humedad_suelo_0_10cm'] ?? null, 'temperatura_suelo' => $forecast['actual']['temperatura_suelo_0_10cm'] ?? null];
} catch (Throwable $error) { $report['pronostico'] = ['disponible' => false, 'mensaje' => $error->getMessage()]; }
try {
    $archive = (new ProveedorOpenMeteo())->obtenerResumenMensual12Meses(-1.05, -80.45);
    $report['historial'] = ['disponible' => $archive !== null, 'meses' => count($archive['meses'] ?? []), 'periodo' => $archive['periodo'] ?? null];
} catch (Throwable $error) { $report['historial'] = ['disponible' => false, 'mensaje' => $error->getMessage()]; }
$cache = new class implements CacheInterface {
    public function obtener(string $clave, int $ttlSegundos = 86400): ?array { return null; }
    public function guardar(string $clave, array $valor): void {}
    public function limpiarExpirados(): void {}
};
$enso = (new ProveedorNoaaOni($cache))->obtenerOni();
$report['noaa'] = $enso ? array_intersect_key($enso, array_flip(['indice', 'valor_indice', 'periodo', 'fuente', 'vigente', 'episodio_declarado'])) : ['disponible' => false];
$out = __DIR__ . '/../documentacion/fuentes-maiz/descargas/clima-20261115';
if (!is_dir($out)) mkdir($out, 0775, true);
file_put_contents($out . '/conexiones-publicas.json', json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
