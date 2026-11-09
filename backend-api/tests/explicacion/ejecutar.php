<?php
// Pruebas de evidencia, ausencia y contrato del intérprete agrícola. Sin BD, red ni procesos.
declare(strict_types=1);

require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\RegistroExplicadores;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad;
use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\CatalogoIndicadores;
use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EvaluadorCondiciones;
use ZeaSys\Kernel\Errores\ValidacionException;

set_error_handler(static function (int $nivel, string $mensaje, string $archivo, int $linea): never { throw new ErrorException($mensaje, 0, $nivel, $archivo, $linea); });

final class CultivosExplicacion implements CultivoRepositoryInterface
{
    public int $consultas = 0;
    public function obtenerPorId(int $id): ?array { $this->consultas++; return ['id' => $id, 'usuario_id' => 7, 'nombre_parcela' => 'Lote de prueba', 'area' => 2.0]; }
    public function crear(array $datos): int { throw new RuntimeException('No debe escribir.'); }
    public function obtenerPorUsuario(int $usuarioId): array { return []; }
    public function obtenerConCoordenadas(int $usuarioId): array { return []; }
    public function actualizar(int $id, array $datos): bool { throw new RuntimeException('No debe escribir.'); }
    public function eliminar(int $id): bool { throw new RuntimeException('No debe escribir.'); }
    public function contarPorUsuario(int $usuarioId): int { return 0; }
    public function areaTotalPorUsuario(int $usuarioId): float { return 0; }
}

final class SimulacionesExplicacion implements SimulacionRepositoryInterface
{
    public array $consultas = [];
    public function __construct(public ?array $fila = null) {}
    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $año = null): ?array { $this->consultas[] = [$cultivoId, $año]; return $this->fila; }
    public function guardar(array $datos, array $resultado): int { throw new RuntimeException('No debe escribir.'); }
    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null, int $desplazamiento = 0): array { return []; }
    public function obtenerAniosPorUsuario(int $usuarioId): array { return []; }
    public function obtenerPorId(int $id): ?array { return null; }
    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array { return []; }
    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array { return []; }
    public function obtenerRecientesPorCultivo(int $usuarioId, int $cultivoId, int $limite = 50, ?int $year = null): array { return []; }
    public function eliminar(int $id): bool { throw new RuntimeException('No debe escribir.'); }
    public function contarPorUsuario(int $usuarioId): int { return 0; }
}

function comprobar(bool $condicion, string $mensaje): void { if (!$condicion) throw new RuntimeException($mensaje); }
function texto(array $respuesta): string { return implode(' ', array_column($respuesta['secciones'], 'contenido')); }
function servicio(?array $fila = null): array {
    $cultivos = new CultivosExplicacion();
    $simulaciones = new SimulacionesExplicacion($fila);
    $resolutor = new ResolutorContextoExplicacion($cultivos, $simulaciones);
    return [new ServicioExplicabilidad(new EvaluadorCondiciones(), new RegistroExplicadores(), $resolutor), $resolutor, $cultivos, $simulaciones];
}
function rechaza(callable $accion): void {
    try { $accion(); } catch (ValidacionException $e) { comprobar($e->codigoHttp() === 400, 'Debe ser HTTP 400.'); return; }
    throw new RuntimeException('Debe rechazar la entrada inválida.');
}
function contrato(array $r): void {
    comprobar(array_keys($r) === ['titulo', 'nivel', 'nivel_del_resultado', 'secciones', 'que_significa', 'por_que_pudo_pasar', 'como_mejorarlo', 'alerta_clave', 'source', 'offline'], 'Debe conservar las claves del contrato del modal.');
    comprobar(count($r['secciones']) === 3 && $r['offline'] === true, 'Debe conservar las tres secciones y modo local.');
    comprobar($r['que_significa'] === $r['secciones'][0]['contenido'] && $r['como_mejorarlo'] === $r['secciones'][2]['contenido'], 'Los campos compatibles deben coincidir con las secciones.');
    foreach ($r['secciones'] as $s) comprobar(array_keys($s) === ['titulo', 'tipo', 'contenido'] && is_string($s['contenido']), 'Cada sección debe conservar su forma.');
}

$titulos = [
    'AccionPrioritaria' => 'Acción prioritaria', 'AguaInicial' => 'Agua Útil Inicial en Suelo',
    'AguaPorEstrato' => 'Agua por Estrato', 'AguaUtil' => 'Agua útil', 'BeneficioCosto' => 'Relación Beneficio / Costo (B/C)',
    'CapacidadSuelo' => 'Capacidad del suelo', 'Cascada' => 'Cascada de contribuciones', 'ComparadorHibridos' => 'Comparador de híbridos',
    'CostoTotal' => 'Costo total', 'CurvaTemporal' => 'Curva temporal', 'Default' => 'Medición adicional',
    'DesviacionMensual' => 'Desviación mensual', 'DistribucionProbabilistica' => 'Distribución de percentiles',
    'ENSO' => 'Estado ENSO', 'Estabilidad' => 'Estabilidad de rendimiento', 'Estrategia' => 'Estrategia de manejo',
    'FaseFenologica' => 'Fase fenológica', 'FechaSiembra' => 'Fecha de siembra recomendada', 'GananciaPorDolar' => 'Ganancia por Dólar Invertido',
    'GraficoGenerico' => 'Gráfico de observaciones', 'IndiceCosecha' => 'Índice de cosecha', 'IngresoBruto' => 'Ingreso bruto',
    'LimitantePrincipal' => 'Limitante principal', 'LluviaPromedio' => 'Probabilidad de lluvia por debajo del promedio',
    'MargenNeto' => 'Margen Neto Estimado', 'MargenSeguridad' => 'Margen de Seguridad Productivo', 'MesEspecifico' => 'Mes de enero',
    'NivelConfianza' => 'Nivel de confianza', 'PerdidaAgua' => 'Pérdida de agua', 'PerdidaNitrogeno' => 'Pérdida de nitrógeno',
    'PerfilesProduccion' => 'Perfiles financieros y modelos de producción', 'PotencialGenetico' => 'Potencial genético',
    'PrecioMinimo' => 'Precio mínimo de venta', 'ProbabilidadCosecha' => 'Probabilidad de cosecha', 'PuntoEquilibrio' => 'Punto de equilibrio',
    'RadiacionFotosintetica' => 'PAR estimada', 'RendimientoAlcanzable' => 'Rendimiento alcanzable', 'RendimientoCentral' => 'Rendimiento central esperado',
    'RendimientoPredicho' => 'Rendimiento predicho', 'RiesgoEstacional' => 'Riesgo agronómico compuesto', 'RiesgoFinanciero' => 'Riesgo financiero de pérdida',
    'ROI' => 'Retorno de inversión (ROI)', 'Sensibilidad' => 'Sensibilidad precio vs rendimiento', 'SuperarObjetivo' => 'Probabilidad de superar el objetivo',
    'TIR' => 'Tasa Interna de Retorno (TIR) Estimada', 'YieldGap' => 'Brecha de rendimiento',
];
$pruebas = [];
$pruebas['el catálogo, las estrategias y el registro cubren los mismos 46 indicadores'] = static function () use ($titulos): void {
    $catalogo = array_keys(CatalogoIndicadores::todos());
    $registro = array_map(static fn (array $r): string => substr($r['explicador'], strrpos($r['explicador'], '\\') + strlen('\\Explicador')), (new RegistroExplicadores())->reglas());
    $esperados = array_keys($titulos);
    sort($catalogo); sort($registro); sort($esperados);
    comprobar(count($catalogo) === 46 && $catalogo === $esperados && $registro === $esperados, 'Debe cubrir los 46 indicadores sin estrategias inaccesibles.');
};
foreach ($titulos as $clave => $titulo) {
    $pruebas["{$clave}: ausencia conserva contrato y definición específica"] = static function () use ($clave, $titulo): void {
        [$s] = servicio();
        $r = $s->explicar(['nombre' => $titulo, 'año' => 2026]);
        contrato($r);
        comprobar(str_contains(texto($r), CatalogoIndicadores::obtener($clave)['definicion']), 'Debe seleccionar el significado específico del indicador.');
        comprobar(str_starts_with($r['que_significa'], 'No hay un dato disponible'), 'Debe comunicar la ausencia.');
        comprobar(!preg_match('/7\.5|11\.2|0\.4|16\.50|180 kg|2 t\/ha/', texto($r)), 'No debe inventar mediciones, pérdidas, precios o dosis.');
    };
    $pruebas["{$clave}: cero explícito es evidencia válida"] = static function () use ($clave, $titulo): void {
        [$s] = servicio();
        $entrada = ['nombre' => $titulo, 'valor' => 0];
        if (CatalogoIndicadores::obtener($clave)['tipo'] === 'grafico') $entrada += ['tipo_elemento' => 'grafico', 'datos_grafico' => ['labels' => ['A', 'B', 'C'], 'datasets' => [['label' => 'Datos', 'data' => [0, null, 0]]]]];
        $r = $s->explicar($entrada);
        contrato($r);
        comprobar(str_contains(texto($r), CatalogoIndicadores::obtener($clave)['definicion']), 'Debe conservar la interpretación específica con datos.');
        comprobar(!str_starts_with($r['que_significa'], 'No hay un dato disponible') && str_contains(texto($r), '0'), 'Cero no debe confundirse con ausencia.');
    };
}

foreach (['nombre', 'titulo', 'estado', 'unidad', 'rango_ideal', 'descripcion_tecnica', 'impacto_base', 'recomendacion_base', 'fuente', 'fecha', 'periodo_precipitacion', 'alerta', 'tipo_elemento'] as $campo) {
    foreach ([[], new stdClass(), true, 3] as $i => $valor) {
        $pruebas["rechaza texto {$campo} inválido #{$i} antes de consultar"] = static function () use ($campo, $valor): void {
            [$s, , $c, $sim] = servicio();
            rechaza(static fn () => $s->explicar([$campo => $valor, 'cultivo_id' => 1]));
            comprobar($c->consultas === 0 && $sim->consultas === [], 'Debe validar antes de consultar datos.');
        };
    }
}
foreach (['valor', 'rendimiento_estimado', 'potencial_max', 'temperatura', 'precipitacion', 'fertilizante'] as $campo) {
    foreach ([[], new stdClass(), true, INF] as $i => $valor) $pruebas["rechaza valor {$campo} inválido #{$i}"] = static function () use ($campo, $valor): void { [$s] = servicio(); rechaza(static fn () => $s->explicar([$campo => $valor])); };
}
foreach (['datos_grafico', 'intervalo_rendimiento', 'explicacion_modelo', 'trazabilidad'] as $campo) {
    foreach (['texto', true, new stdClass()] as $i => $valor) $pruebas["rechaza objeto {$campo} inválido #{$i}"] = static function () use ($campo, $valor): void { [$s] = servicio(); rechaza(static fn () => $s->explicar([$campo => $valor])); };
}
foreach (['—', '-', 'N/D', 'Sin datos', 'No disponible', 'ROI no calculable', '', null] as $i => $valor) $pruebas["marcador de ausencia #{$i} no rescata una simulación"] = static function () use ($valor): void {
    [$s] = servicio(['rendimiento_estimado' => 9.123, 'fecha' => '2026-01-01']);
    $r = $s->explicar(['nombre' => 'Rendimiento predicho', 'cultivo_id' => 1, 'año' => 2026, 'valor' => $valor]);
    comprobar(str_starts_with($r['que_significa'], 'No hay un dato disponible') && !str_contains(texto($r), '9.123'), 'No debe sustituir un dato ausente de la tarjeta.');
};
$pruebas['resolutor sin evidencia deja todas las magnitudes asumidas en null'] = static function (): void {
    [, $r] = servicio(); $c = $r->construir([]);
    foreach (['area_ha', 'ph_suelo', 'fertilizante', 'temperatura', 'precipitacion', 'humedad', 'rend_predicho', 'potencial_max', 'loss_n', 'loss_water', 'principal_perdida', 'perdida_dolares_ha'] as $campo) comprobar($c[$campo] === null, 'Debe conservar ausencia de ' . $campo);
};
$pruebas['lectura actual explícita y cero prevalecen frente a una simulación guardada'] = static function (): void {
    [$s, $r] = servicio(['rendimiento_estimado' => 9.123, 'temperatura' => 25, 'fecha' => '2026-01-01']);
    $c = $r->construir(['cultivo_id' => 1, 'año' => 2026, 'temperatura' => 0, 'rendimiento_estimado' => null]);
    comprobar($c['temperatura'] === 0.0 && $c['rend_predicho'] === null, 'Debe respetar cero y null explícitos.');
    $explicacion = $s->explicar(['nombre' => 'Rendimiento predicho', 'cultivo_id' => 1, 'año' => 2026, 'valor' => 0]);
    comprobar(str_contains($explicacion['que_significa'], ': 0.') && !str_contains(texto($explicacion), '9.123'), 'Debe explicar el dato seleccionado, sin sustituirlo.');
};
$pruebas['un adapter que devuelve otro año no contamina el rendimiento'] = static function (): void {
    [$s] = servicio(['rendimiento_estimado' => 9.123, 'fecha' => '2025-01-01']);
    $r = $s->explicar(['nombre' => 'Rendimiento predicho', 'cultivo_id' => 1, 'año' => 2026]);
    comprobar(str_starts_with($r['que_significa'], 'No hay un dato disponible') && !str_contains(texto($r), '9.123'), 'No debe usar un año diferente.');
};
$pruebas['clima y suelo se explican sin requerir rendimiento'] = static function (): void {
    [$s] = servicio();
    foreach ([['nombre' => 'Estado ENSO', 'valor' => 'Neutral'], ['nombre' => 'Agua útil', 'agua_util_mm' => 0], ['nombre' => 'PAR estimada', 'radiacion_par' => 0]] as $e) comprobar(!str_starts_with($s->explicar($e)['que_significa'], 'No hay un dato disponible'), 'Debe usar la evidencia climática o de suelo independiente.');
};
$pruebas['brecha usa solo referencia y predicción explícitas sin monetización'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Brecha de rendimiento', 'potencial_max' => 12, 'rendimiento_estimado' => 7]);
    comprobar(str_contains($r['que_significa'], '5 t/ha') && !str_contains(texto($r), 'USD'), 'Debe calcular solo la diferencia respaldada.');
    comprobar(str_starts_with($s->explicar(['nombre' => 'Brecha de rendimiento', 'rendimiento_estimado' => 7])['que_significa'], 'No hay un dato disponible'), 'Sin referencia no hay brecha cuantificada.');
};
$pruebas['índice de cosecha usa masas aportadas y preserva grano cero'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Índice de cosecha', 'grano_seco_kg' => 0, 'biomasa_seca_kg' => 5]);
    comprobar(str_contains($r['que_significa'], ': 0.') && str_contains(texto($r), 'masas secas'), 'Debe calcular el índice desde las masas aportadas.');
};
$pruebas['rendimiento muestra intervalo y aportes SHAP existentes sin atribución causal'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Rendimiento predicho', 'rendimiento_estimado' => 4, 'intervalo_rendimiento' => ['min' => 3, 'max' => 5], 'explicacion_modelo' => ['base' => 5, 'aportes' => ['temperatura' => -0.8, 'precipitacion' => -0.2]]]);
    comprobar(str_contains(texto($r), '3 a 5 t/ha') && str_contains(texto($r), 'temperatura (-0.8 t/ha)'), 'Debe interpretar el intervalo y el mayor aporte negativo real.');
    comprobar(str_contains(texto($r), 'no demuestra una causa') && !str_contains(texto($r), '16.50'), 'No debe convertir aportes en ganancias monetarias.');
};
$pruebas['metadatos guardados conservan evidencia SHAP y rango del modelo'] = static function (): void {
    $meta = ['explicacion_modelo' => ['base' => 4, 'aportes' => ['fertilizante' => 0]], 'intervalo_rendimiento' => ['min' => 3, 'max' => 5]];
    [$s] = servicio(['rendimiento_estimado' => 4, 'fecha' => '2026-01-01', 'escenarios_json' => json_encode(['_zeasys_modelo' => $meta])]);
    $r = $s->explicar(['nombre' => 'Rendimiento predicho', 'cultivo_id' => 1, 'año' => 2026]);
    comprobar(str_contains(texto($r), '3 a 5 t/ha') && str_contains(texto($r), 'simulación seleccionada'), 'Debe conservar la evidencia persistida.');
};
$pruebas['una tarjeta actual no hereda incertidumbre ni aportes de otra ejecución del año'] = static function (): void {
    $meta = ['intervalo_rendimiento' => ['min' => 8.91, 'max' => 9.87], 'explicacion_modelo' => ['aportes' => ['temperatura' => -2.34]]];
    [$s] = servicio(['rendimiento_estimado' => 9, 'fecha' => '2026-01-01', 'escenarios_json' => json_encode(['_zeasys_modelo' => $meta])]);
    $r = $s->explicar(['nombre' => 'Rendimiento predicho', 'cultivo_id' => 1, 'año' => 2026, 'valor' => 4]);
    comprobar(!str_contains(texto($r), '8.91') && !str_contains(texto($r), '-2.34'), 'La lectura explícita no debe heredar metadatos de una simulación guardada.');
};
$pruebas['pérdida sin evidencia no se deriva de fertilizante o lluvia'] = static function (): void {
    [$s] = servicio();
    foreach (['Pérdida de agua', 'Pérdida de nitrógeno'] as $nombre) comprobar(str_starts_with($s->explicar(['nombre' => $nombre, 'precipitacion' => 0, 'fertilizante' => 0])['que_significa'], 'No hay un dato disponible'), 'No debe inventar pérdidas con reglas de umbral.');
};
$pruebas['aporte SHAP cero no recibe una pérdida mínima ni dosis'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Pérdida de nitrógeno', 'explicacion_modelo' => ['aportes' => ['fertilizante' => 0]]]);
    comprobar(str_contains($r['que_significa'], ': 0 t/ha') && str_contains(texto($r), 'no se añade una pérdida mínima'), 'Debe conservar el cero SHAP.');
    comprobar(!preg_match('/0\.4|180|urea|2 t\/ha/', texto($r)), 'No debe prescribir dosis desde una contribución del modelo.');
};
$pruebas['lluvia anual y por ciclo se identifican sin conversión ni umbral'] = static function (): void {
    [$s] = servicio();
    foreach (['mm/año', 'mm/ciclo'] as $periodo) {
        $r = $s->explicar(['nombre' => 'Probabilidad de lluvia por debajo del promedio', 'valor' => 0, 'periodo_precipitacion' => $periodo]);
        comprobar(str_contains(texto($r), $periodo . '; no se convierte a otro periodo'), 'Debe conservar el periodo declarado.');
    }
};
$pruebas['datos económicos aportados mantienen su unidad sin recalcular desde cosecha'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Margen Neto Estimado', 'valor' => '-1.234,56 USD', 'unidad' => '/ha', 'rendimiento_estimado' => 9]);
    comprobar(str_contains(texto($r), '-1.234,56 USD /ha') && !str_contains(texto($r), '16.50'), 'Debe conservar la lectura económica localizada sin asumir precios.');
    comprobar(str_contains(texto($s->explicar(['nombre' => 'ROI', 'valor' => -5])), 'resultado aportado es negativo'), 'Debe interpretar el signo de un ROI numérico.');
    comprobar(str_contains(texto($s->explicar(['nombre' => 'Beneficio/costo', 'valor' => 1])), 'ingresos y costos considerados se igualan'), 'Debe interpretar B/C igual a uno.');
};
$pruebas['sensibilidad describe escenarios negativos sin declararlos probabilidad'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Sensibilidad económica', 'datos_grafico' => [['precio' => 10, 'rendimiento' => 2, 'margen' => -10], ['precio' => 12, 'rendimiento' => 3, 'margen' => 0], ['precio' => 14, 'rendimiento' => 4, 'margen' => 20]]]);
    comprobar(str_contains(texto($r), 'margen negativo: 1 de 3') && str_contains(texto($r), 'no es una probabilidad'), 'Debe resumir el conjunto aportado con su límite.');
};
$pruebas['curva temporal mantiene series separadas y descarta huecos'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Curva temporal', 'datos_grafico' => ['labels' => ['Ene', 'Feb', 'Mar'], 'lluvia_historica' => [0, null, 20], 'temperatura_anomala' => [18, 19, 21]]]);
    comprobar(str_contains(texto($r), 'lluvia_historica: 2 valores presentes, mínimo 0 y máximo 20') && str_contains(texto($r), 'temperatura_anomala: 3'), 'No debe imputar huecos ni mezclar temperatura con lluvia.');
};
$pruebas['cascada reconstruye aportes explícitos sin inventar potencial'] = static function (): void {
    [$s] = servicio(); $r = $s->explicar(['nombre' => 'Cascada de aportes', 'rendimiento_estimado' => 4, 'explicacion_modelo' => ['base' => 5, 'aportes' => ['temperatura' => -1, 'fertilizante' => 0]]]);
    comprobar(str_contains(texto($r), 'reconstrucción: 4 t/ha') && !str_contains(texto($r), '11.2'), 'Debe reconstruir exclusivamente desde la base y aportes reales.');
};
foreach ([['datos_grafico' => ['datasets' => [['data' => [true]]]]], ['datos_grafico' => ['datasets' => 'invalido']], ['datos_grafico' => ['p10' => 5, 'p50' => 2, 'p90' => 8]], ['intervalo_rendimiento' => ['min' => 5, 'max' => 2]], ['explicacion_modelo' => ['aportes' => ['fertilizante' => []]]], ['cultivo_id' => true], ['año' => '2026x']] as $i => $entrada) $pruebas["estructura anidada o filtro inválido #{$i}"] = static function () use ($entrada): void { [$s] = servicio(); rechaza(static fn () => $s->explicar($entrada + ['nombre' => 'Distribución de percentiles'])); };

$fallos = 0;
foreach ($pruebas as $nombre => $prueba) {
    try { $prueba(); echo "[OK] {$nombre}\n"; }
    catch (Throwable $e) { $fallos++; echo "[FAIL] {$nombre}: {$e->getMessage()}\n"; }
}
echo "\n" . (count($pruebas) - $fallos) . ' passed, ' . $fallos . " failed\n";
exit($fallos > 0 ? 1 : 0);
