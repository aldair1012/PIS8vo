<?php
// Finanzas: presupuesto hipotético, ceros reales y procedencia. Sin PDO ni red.
declare(strict_types=1);
namespace ZeaSys\Tests\AnaliticaFinanzas;
require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
\ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');
use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaFinancial;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

set_error_handler(static function (int $nivel, string $mensaje, string $archivo, int $linea): bool { throw new \ErrorException($mensaje, 0, $nivel, $archivo, $linea); });
final class Cultivos implements CultivoRepositoryInterface {
    public function __construct(private array $lote) {}
    public function obtenerPorId(int $id): ?array { return $this->lote; }
    public function crear(array $datos): int { throw new \RuntimeException('No escribir.'); }
    public function obtenerPorUsuario(int $usuarioId): array { throw new \RuntimeException('No elegir primera parcela arbitraria.'); }
    public function obtenerConCoordenadas(int $usuarioId): array { return []; }
    public function actualizar(int $id, array $datos): bool { throw new \RuntimeException('No escribir.'); }
    public function eliminar(int $id): bool { throw new \RuntimeException('No escribir.'); }
    public function contarPorUsuario(int $usuarioId): int { return 1; }
    public function areaTotalPorUsuario(int $usuarioId): float { return 1.0; }
}
final class Simulaciones implements SimulacionRepositoryInterface {
    public array $consultas = [];
    public function __construct(private array $filas = []) {}
    public function obtenerRecientesPorCultivo(int $usuarioId, int $cultivoId, int $limite = 50, ?int $year = null): array {
        $this->consultas[] = [$usuarioId, $cultivoId, $limite, $year];
        return array_slice(array_values(array_filter($this->filas, static fn (array $s): bool => (int) ($s['cultivo_id'] ?? 1) === $cultivoId)), 0, $limite);
    }
    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array { $this->consultas[] = [$usuarioId, null, $limite, $year]; return array_slice($this->filas, 0, $limite); }
    public function guardar(array $datos, array $resultado): int { throw new \RuntimeException('No escribir.'); }
    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null, int $desplazamiento = 0): array { return []; }
    public function obtenerAniosPorUsuario(int $usuarioId): array { return []; }
    public function obtenerPorId(int $id): ?array { return null; }
    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array { throw new \RuntimeException('No usar estadísticas globales.'); }
    public function eliminar(int $id): bool { throw new \RuntimeException('No escribir.'); }
    public function contarPorUsuario(int $usuarioId): int { return count($this->filas); }
    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $año = null): ?array { return null; }
}
function comprobar(bool $valor, string $mensaje): void { if (!$valor) throw new \RuntimeException($mensaje); }
function peticion(array $query): Peticion {
    $_GET = $query; $_SERVER['REQUEST_METHOD'] = 'GET';
    return Peticion::desdeGlobal('analitica/financial');
}
function fixture(array $filas = [], array $query = [], array $lote = [], ?int $id = 1): array {
    $cultivo = array_replace(['id' => 1, 'usuario_id' => 7, 'area' => 1.0, 'nombre_parcela' => 'Prueba'], $lote);
    return (new ServicioAnaliticaFinancial(new Cultivos($cultivo), new Simulaciones($filas)))->construir(7, $id, 2026, peticion($query));
}
function ceroCostos(): array { return ['costo_semilla' => 0, 'costo_fert' => 0, 'costo_riego' => 0, 'costo_proteccion' => 0, 'otros_var' => 0, 'costos_fijos' => 0]; }
function finitos(mixed $valor): bool {
    if (is_float($valor)) return is_finite($valor);
    if (is_array($valor)) foreach ($valor as $v) if (!finitos($v)) return false;
    return true;
}
$pruebas = [];
$pruebas['sin muestra ni overrides conserva estado vacío'] = static function (): void { comprobar(fixture()['sin_datos'] === true, 'No fabricar una muestra.'); };
$pruebas['overrides de costos sin rendimiento no fabrican6.25t ni110qq'] = static function (): void {
    $d = fixture(query: ['costo_fert' => 130]);
    comprobar($d['datos_base_sistema']['rendimiento_qq'] === null && $d['datos_base_sistema']['rendimiento_tha'] === null, 'Rendimiento ausente.');
    foreach (['ingreso_bruto', 'margen_neto', 'roi', 'precio_piso_qq'] as $campo) comprobar($d['kpis'][$campo] === null, 'No computar ingresos sin rendimiento.');
    comprobar($d['resumen_descriptivo']['muestra'] === 0 && $d['rendimientos_rango'] === [] && $d['sensibilidad'] === [], 'No fabricar simulaciones/sensibilidad.');
};
$pruebas['rendimiento cero guardado conserva pérdidas y nunca se sustituye110qq'] = static function (): void {
    $d = fixture([['rendimiento_estimado' => 0]]);
    comprobar($d['datos_base_sistema']['rendimiento_qq'] === 0.0 && $d['kpis']['ingreso_bruto'] === 0.0, 'Conservar cero.');
    comprobar($d['kpis']['margen_neto'] === -510.0 && $d['kpis']['roi'] === -100.0, 'Pérdida del presupuesto supuesto.');
    comprobar($d['kpis']['precio_piso_qq'] === null, 'No dividir costos entre cero.');
};
$pruebas['área0.01ha conserva tamaño y totales reales de la parcela'] = static function (): void {
    $d = fixture([['rendimiento_estimado' => 1]], lote: ['area' => 0.01]);
    comprobar($d['kpis']['area_parcela'] === 0.01 && $d['kpis']['costo_total_parcela'] === 5.1, 'No forzar0.1ha.');
    comprobar($d['kpis']['produccion_total_qq'] === 0.22, 'Escalar producción por0.01ha.');
};
$pruebas['precio cero produce ingreso cero y equilibrio no disponible'] = static function (): void {
    $d = fixture([['rendimiento_estimado' => 5]], ['precio_maiz_qq' => 0]);
    comprobar($d['kpis']['precio_maiz_qq'] === 0.0 && $d['kpis']['ingreso_bruto'] === 0.0, 'No sustituir precio0 por16.5.');
    comprobar($d['kpis']['punto_equilibrio'] === null, 'Sin precio positivo no hay rendimiento de equilibrio finito.');
};
$pruebas['precio positivo pequeño no se convierte en precio cero antes de calcular'] = static function (): void {
    $d = fixture([['rendimiento_estimado' => 5]], ['precio_maiz_qq' => 0.0001]);
    comprobar($d['datos_base_sistema']['precio_maiz_qq'] === 0.0001, 'Conservar precio para siguientes recálculos.');
    comprobar($d['kpis']['punto_equilibrio'] !== null && $d['kpis']['punto_equilibrio'] > 0, 'Calcular con precio sin redondear previamente.');
};
$pruebas['costos cero preservan margen, ROI indefinido y equilibrio cero válido'] = static function (): void {
    $d = fixture([['rendimiento_estimado' => 5]], ceroCostos());
    comprobar($d['costo_total'] === 0.0 && $d['kpis']['roi'] === null && $d['kpis']['ganancia_por_dolar'] === null, 'No dividir por costo0.');
    comprobar($d['kpis']['margen_neto'] === $d['kpis']['ingreso_bruto'] && $d['kpis']['punto_equilibrio'] === 0.0, 'Preservar presupuesto0.');
};
$pruebas['presupuesto manual funciona sin simulaciones y sin parcela arbitraria'] = static function (): void {
    $d = fixture(query: ['rendimiento_qq' => 100, 'precio_maiz_qq' => 20], id: null);
    comprobar($d['kpis']['ingreso_bruto'] === 2000.0 && $d['kpis']['margen_neto'] === 1490.0, 'Cálculo porha correcto.');
    comprobar($d['kpis']['area_parcela'] === null && $d['kpis']['ingreso_bruto_parcela'] === null, 'No asignar primer lote ni1ha.');
    comprobar($d['supuestos']['fuentes']['rendimiento_qq'] === 'supuesto_ingresado_usuario', 'Origen manual explícito.');
};
$pruebas['costos defaults son supuestos y no derivan de dosisN'] = static function (): void {
    $a = fixture([['rendimiento_estimado' => 5, 'fertilizante' => 500]]);
    $b = fixture([['rendimiento_estimado' => 5, 'fertilizante' => 0]]);
    comprobar($a['datos_base_sistema']['costo_fert'] === 120.0 && $b['datos_base_sistema']['costo_fert'] === 120.0, 'KgN no son USD.');
    comprobar($a['supuestos']['fuentes']['costo_fert'] === 'supuesto_configurable_sin_costo_observado', 'Identificar costo supuesto.');
    comprobar($a['supuestos']['fuentes']['precio_maiz_qq'] === 'supuesto_configurable_sin_cotizacion_mercado', 'No fingir cotización actual.');
};
$pruebas['frecuencia empírica incluye ceros y no se llama probabilidad'] = static function (): void {
    $filas = array_map(static fn (int $r): array => ['rendimiento_estimado' => $r], [0, 1, 2, 3, 4]);
    $d = fixture($filas);
    comprobar($d['kpis']['prob_superar_break_even'] === null, 'Probabilidad calibrada ausente.');
    comprobar($d['resumen_descriptivo']['muestra'] === 5 && $d['resumen_descriptivo']['fraccion_cubre_costos_pct'] === 60.0, 'Contar todas las muestras, incluidas pérdidas0.');
};
$pruebas['menos de5 muestras conserva fracción no disponible'] = static function (): void {
    comprobar(fixture([['rendimiento_estimado' => 5]])['resumen_descriptivo']['fraccion_cubre_costos_pct'] === null, 'No fingir respaldo muestral.');
};
$pruebas['más de50 registros ajenos no ocultan la parcela seleccionada'] = static function (): void {
    $filas = array_fill(0, 60, ['cultivo_id' => 2, 'rendimiento_estimado' => 9]);
    $filas[] = ['cultivo_id' => 1, 'rendimiento_estimado' => 3];
    $repo = new Simulaciones($filas);
    $d = (new ServicioAnaliticaFinancial(new Cultivos(['usuario_id' => 7, 'area' => 1]), $repo))->construir(7, 1, 2025, peticion([]));
    comprobar($repo->consultas === [[7, 1, 50, 2025]] && $d['datos_base_sistema']['rendimiento_tha'] === 3.0, 'Filtrar parcela/año antesdeLIMIT.');
};
$pruebas['entrada inválida y suma de costos desbordada se rechazan'] = static function (): void {
    foreach ([['precio_maiz_qq' => true], ['rendimiento_qq' => []], ['costo_fert' => 'nan'], ['costo_semilla' => 1e308, 'costo_fert' => 1e308]] as $query) {
        try { fixture(query: $query); throw new \RuntimeException('Debió rechazar entrada inválida.'); }
        catch (ValidacionException) {}
    }
};
$pruebas['resultados que exceden representación permanecen null y JSON finito'] = static function (): void {
    $d = fixture(query: ['rendimiento_qq' => 1e308, 'precio_maiz_qq' => 1e308], lote: ['area' => 1e308]);
    comprobar($d['kpis']['ingreso_bruto'] === null && $d['kpis']['margen_neto'] === null && finitos($d), 'No serializarInfinity/NaN.');
    json_encode($d, JSON_THROW_ON_ERROR);
};
$pruebas['sensibilidad y estrategias se conservan como hipótesis explícitas'] = static function (): void {
    $d = fixture(query: ['rendimiento_qq' => 100, 'precio_maiz_qq' => 20]);
    comprobar(count($d['sensibilidad']) === 25 && count($d['roi_estrategias']) === 4, 'Conservar herramienta sensibilidad.');
    foreach ($d['sensibilidad'] as $celda) comprobar($celda['tipo'] === 'escenario_hipotetico', 'No presentar escenario como registro.');
    comprobar($d['roi_estrategias'][0]['margen'] === 1490.0, 'Escenario base correcto.');
};
$pruebas['parcela ajena no consulta simulaciones'] = static function (): void {
    $repo = new Simulaciones();
    try { (new ServicioAnaliticaFinancial(new Cultivos(['usuario_id' => 8]), $repo))->construir(7, 1, null, peticion([])); throw new \RuntimeException('Debió negar acceso.'); }
    catch (AccesoDenegadoException) { comprobar($repo->consultas === [], 'Autorizar antesdeconsultar.'); }
};
$fallos = 0;
foreach ($pruebas as $nombre => $prueba) {
    try { $prueba(); echo "[OK] {$nombre}\n"; }
    catch (\Throwable $e) { $fallos++; echo "[FAIL] {$nombre}: {$e->getMessage()}\n"; }
}
echo (count($pruebas) - $fallos) . ' passed, ' . $fallos . " failed\n";
exit($fallos ? 1 : 0);
