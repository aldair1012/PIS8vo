<?php
// Regresiones de procedencia y resúmenes descriptivos. Sin PDO, red ni escrituras de usuarios.
declare(strict_types=1);
namespace ZeaSys\Tests\AnaliticaClimaEscenarios;
require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
\ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate;
use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaScenario;
use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioClimaActual;
use ZeaSys\Dominios\Terreno\Dominio\AltitudPorCultivoInterface;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaActualInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

set_error_handler(static function (int $nivel, string $mensaje, string $archivo, int $linea): bool {
    throw new \ErrorException($mensaje, 0, $nivel, $archivo, $linea);
});

final class Catalogo implements CatalogoAgronomicoInterface {
    public function __construct(private array $datos = []) {}
    public function cargar(): array { return $this->datos; }
}
final class Cultivos implements CultivoRepositoryInterface {
    public function __construct(private ?array $lote) {}
    public function obtenerPorId(int $id): ?array { return $this->lote; }
    public function crear(array $datos): int { throw new \RuntimeException('No escribir.'); }
    public function obtenerPorUsuario(int $usuarioId): array { return $this->lote ? [$this->lote] : []; }
    public function obtenerConCoordenadas(int $usuarioId): array { return $this->obtenerPorUsuario($usuarioId); }
    public function actualizar(int $id, array $datos): bool { throw new \RuntimeException('No escribir.'); }
    public function eliminar(int $id): bool { throw new \RuntimeException('No escribir.'); }
    public function contarPorUsuario(int $usuarioId): int { return $this->lote ? 1 : 0; }
    public function areaTotalPorUsuario(int $usuarioId): float { return 1.0; }
}
final class Simulaciones implements SimulacionRepositoryInterface {
    public ?array $ultima = null;
    public array $consultas = [];
    public function __construct(private array $filas = []) {}
    public function obtenerRecientesPorCultivo(int $usuarioId, int $cultivoId, int $limite = 50, ?int $year = null): array {
        $this->consultas[] = [$usuarioId, $cultivoId, $limite, $year];
        return array_values(array_filter($this->filas, static fn (array $s): bool => (int) ($s['cultivo_id'] ?? 1) === $cultivoId));
    }
    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array { $this->consultas[] = [$usuarioId, null, $limite, $year]; return $this->filas; }
    public function guardar(array $datos, array $resultado): int { throw new \RuntimeException('No escribir.'); }
    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null, int $desplazamiento = 0): array { return []; }
    public function obtenerAniosPorUsuario(int $usuarioId): array { return []; }
    public function obtenerPorId(int $id): ?array { return null; }
    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array { throw new \RuntimeException('No usar estadísticas globales.'); }
    public function eliminar(int $id): bool { throw new \RuntimeException('No escribir.'); }
    public function contarPorUsuario(int $usuarioId): int { return count($this->filas); }
    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $año = null): ?array { return $this->ultima; }
}
final class Cache implements CacheInterface {
    public array $datos = [];
    public array $claves = [];
    public function obtener(string $clave, int $ttlSegundos = 86400): ?array { $this->claves[] = $clave; return $this->datos[$clave] ?? null; }
    public function guardar(string $clave, array $valor): void { $this->datos[$clave] = $valor; }
    public function limpiarExpirados(): void {}
}
final class Clima implements ProveedorClimaInterface {
    public function __construct(private array $datos = [], private bool $fallar = false) {}
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array {
        if ($this->fallar) throw new ServicioExternoException('Proveedor fuera de línea.');
        return $this->datos;
    }
}
final class Suelo implements ProveedorSueloInterface {
    public function __construct(private array $datos = [], private bool $fallar = false) {}
    public function obtenerSuelo(float $latitud, float $longitud): array {
        if ($this->fallar) throw new ServicioExternoException('Proveedor fuera de línea.');
        return $this->datos;
    }
}
final class Altitud implements AltitudPorCultivoInterface {
    public function altitudPorCoordenadas(float $latitud, float $longitud): ?float { return 45.0; }
}
final class ClimaActual implements ProveedorClimaActualInterface {
    public function __construct(private array $datos = [], private bool $fallar = false) {}
    public function obtenerClimaActual(float $latitud, float $longitud, ?float $altitud = null): array {
        if ($this->fallar) throw new ServicioExternoException('Proveedor fuera de línea.');
        return $this->datos;
    }
}
function comprobar(bool $valor, string $mensaje): void { if (!$valor) throw new \RuntimeException($mensaje); }
function lote(array $extra = []): array { return array_replace(['id' => 1, 'usuario_id' => 7, 'latitud' => -2.0, 'longitud' => -80.0, 'ubicacion' => 'Guayas'], $extra); }
function climate(array $clima = [], array $suelo = [], array $extraLote = [], bool $fallar = false, array $actual = []): array {
    $terreno = new ServicioDatosTerreno(new Cache(), new Clima($clima, $fallar), new Suelo($suelo, $fallar), new Altitud());
    return (new ServicioAnaliticaClimate(new Catalogo(), new Cultivos(lote($extraLote)), $terreno,
        new ServicioClimaActual(new Cache(), new ClimaActual($actual, $fallar))))->construir(7, 1, 2026);
}
function scenario(array $filas, array $catalogo = [], array $extraLote = [], ?int $año = 2026): array {
    return (new ServicioAnaliticaScenario(new Catalogo($catalogo), new Cultivos(lote($extraLote)), new Simulaciones($filas)))->construir(7, 1, $año);
}

$pruebas = [];
$pruebas['proveedores caídos no fabrican clima, probabilidades, agua ni ENSO'] = static function (): void {
    $datos = climate(fallar: true);
    comprobar($datos['clima_actual']['temperatura'] === null && $datos['clima_actual']['humedad'] === null && $datos['clima_actual']['precipitacion'] === null, 'No publicar defaults24/800 como datos.');
    foreach (['prob_lluvia_bajo_promedio', 'prob_estres_termico', 'agua_util'] as $campo) comprobar($datos['kpis'][$campo] === null, 'KPI sin método debe ser null.');
    comprobar($datos['kpis']['enso']['estado'] === null && $datos['kpis']['indice_riesgo']['nivel'] === null, 'No inventar estado ENSO ni riesgo.');
    comprobar($datos['clima_hoy']['disponible'] === false, 'Clima actual debe declarar indisponibilidad.');
};
$pruebas['API parcial no atribuye defaults de otros campos al proveedor'] = static function (): void {
    $datos = climate(['temperatura' => 0], ['ph' => 6.4]);
    comprobar($datos['clima_actual']['temperatura'] === 0.0, 'Conservar cero verdadero.');
    comprobar($datos['clima_actual']['humedad'] === null && $datos['clima_actual']['precipitacion'] === null, 'No mezclar defaults con API parcial.');
    comprobar($datos['suelo']['ph'] === 6.4 && $datos['suelo']['arcilla_pct'] === null, 'No atribuir textura default al proveedor.');
};
$pruebas['conserva datos externos reales y distingue promedio, total30d y clima de hoy'] = static function (): void {
    $actual = ['disponible' => true, 'actual' => ['temperatura_c' => 27], 'pronostico_7d' => [['fecha' => '2026-11-01', 'precipitacion_mm' => 0]]];
    $datos = climate(['temperatura' => 24, 'humedad' => 70, 'precipitacion' => 1200, 'precipitacion_30d' => 100], actual: $actual);
    comprobar($datos['clima_promedio_30d']['temperatura'] === 24.0 && $datos['clima_actual']['precipitacion_30d'] === 100.0, 'Conservar promedios/total.');
    comprobar($datos['clima_hoy']['actual']['temperatura_c'] === 27 && count($datos['pronostico_7d']) === 1, 'Conservar clima de hoy y pronóstico.');
    comprobar($datos['kpis']['agua_util'] === null && $datos['kpis']['prob_estres_termico'] === null, 'Datos externos no calibran probabilidades ni agua útil.');
};
$pruebas['no genera series mensuales ni estratos sintéticos y fenología no observada'] = static function (): void {
    $datos = climate(extraLote: ['fecha_siembra' => '2026-01-31']);
    comprobar($datos['timeline_anomalia']['lluvia_historica'] === array_fill(0, 12, null), 'No simular climatología.');
    comprobar($datos['timeline_anomalia']['lluvia_anomala'] === array_fill(0, 12, null), 'No simular anomalías.');
    comprobar($datos['agua_estratos']['valores'] === array_fill(0, 4, null), 'No inventar reparto por profundidad.');
    comprobar($datos['timeline_fenologico'][1]['mes'] === 'Feb', 'No saltar febrero en siembra fin de mes.');
    foreach ($datos['timeline_fenologico'] as $etapa) comprobar($etapa['estado'] === 'no_evaluado', 'No declarar riesgo observado por etapa.');
};
$pruebas['fecha inválida o coordenadas ausentes no causa500 ni inventa fechas'] = static function (): void {
    $datos = climate(extraLote: ['fecha_siembra' => 'no-es-fecha', 'latitud' => null, 'longitud' => null]);
    comprobar($datos['fecha_siembra'] === null && $datos['clima_hoy'] === null, 'Conservar ausencia.');
    comprobar($datos['timeline_fenologico'][0]['mes'] === 'No disponible', 'No usar meses por defecto.');
};
$pruebas['caché v5 conserva procedencia por campo y referencias etiquetadas'] = static function (): void {
    $cache = new Cache();
    $servicio = new ServicioDatosTerreno($cache, new Clima(['temperatura' => 25]), new Suelo(['ph' => 6]), new Altitud());
    $primero = $servicio->obtener(-2, -80, 45);
    $segundo = $servicio->obtener(-2, -80, 45);
    comprobar(str_starts_with($cache->claves[0], 'precision_data_v7_'), 'Invalidar caché del proveedor de suelo anterior.');
    comprobar($segundo['clima_campos_api'] === ['temperatura'] && $segundo['suelo_campos_api'] === ['ph'], 'Procedencia debe sobrevivir caché.');
    comprobar(in_array('humedad', $primero['procedencia_campos']['clima_referencia_estimada'], true), 'Defaults se etiquetan referencias.');
    comprobar(!in_array('temperatura', $primero['procedencia_campos']['clima_referencia_estimada'], true), 'No etiquetar dato real como default.');
};
$pruebas['resumen conserva medias y percentiles reales sin probabilidades inventadas'] = static function (): void {
    $datos = scenario([['id' => 1, 'rendimiento_estimado' => 4], ['id' => 2, 'rendimiento_estimado' => 8]]);
    comprobar($datos['kpis']['rendimiento_esperado'] === 6.0, 'Media correcta.');
    comprobar($datos['percentiles']['p10'] === 4.4 && $datos['percentiles']['p50'] === 6.0 && $datos['percentiles']['p90'] === 7.6, 'Percentiles descriptivos de muestra.');
    comprobar($datos['kpis']['prob_superar_objetivo'] === null && $datos['kpis']['estabilidad'] === null, 'No convertir CV ni media en probabilidad o estabilidad.');
    comprobar($datos['resumen_descriptivo']['fraccion_supera_objetivo_pct'] === null && $datos['resumen_descriptivo']['coeficiente_variacion_pct'] === 33.33, 'No inventar un objetivo agrícola; conservar CV descriptivo.');
};
$pruebas['muestra única y rendimiento cero conservan ausencia de variación estimable'] = static function (): void {
    $datos = scenario([['id' => 1, 'rendimiento_estimado' => 0]]);
    comprobar($datos['kpis']['rendimiento_esperado'] === 0.0 && $datos['percentiles']['p50'] === 0.0, 'Cero es rendimiento válido.');
    comprobar($datos['resumen_descriptivo']['coeficiente_variacion_pct'] === null && $datos['kpis']['estabilidad'] === null, 'No fabricar85% de estabilidad.');
};
$pruebas['filas ausentes o no numéricas no se convierten en ceros'] = static function (): void {
    $datos = scenario([['rendimiento_estimado' => null], ['rendimiento_estimado' => 'nan'], ['rendimiento_estimado' => true], ['rendimiento_estimado' => -1]]);
    comprobar($datos['sin_datos'] === true, 'No hay muestras válidas.');
};
$pruebas['ranking y mapa solo contienen simulaciones registradas sin ventajas inventadas'] = static function (): void {
    $datos = scenario([['id' => 8, 'nombre' => 'Prueba A', 'rendimiento_estimado' => 3], ['id' => 9, 'nombre' => 'Prueba B', 'rendimiento_estimado' => 7]]);
    comprobar(count($datos['ranking']) === 2 && $datos['ranking'][0]['simulacion_id'] === 9 && $datos['ranking'][0]['valor'] === 7.0, 'Ordenar registros sin rellenar top5.');
    comprobar(count($datos['heatmap']) === 2 && $datos['heatmap'][0]['valor'] === 3.0, 'No generar datos por hash.');
    $json = json_encode($datos, JSON_THROW_ON_ERROR);
    comprobar(!str_contains($json, '<8%') && !str_contains($json, '18 días'), 'No garantizar resiliencia/variación sin evidencia.');
};
$pruebas['periodos anual y ciclo se conservan separados sin diagnósticos de riego'] = static function (): void {
    $modelo = ['_zeasys_modelo' => ['trazabilidad' => ['periodo_precipitacion' => 'mm/ciclo']]];
    $datos = scenario([['id' => 1, 'rendimiento_estimado' => 5, 'precipitacion' => 100], ['id' => 2, 'rendimiento_estimado' => 7, 'precipitacion' => 700, 'escenarios_json' => json_encode($modelo)]]);
    comprobar($datos['simulaciones'][0]['periodo_precipitacion'] === 'legacy_no_verificado' && $datos['simulaciones'][1]['periodo_precipitacion'] === 'mm/ciclo', 'Conservar periodo por muestra.');
    comprobar($datos['kpis']['riesgo_agronomico']['nivel'] === null, 'No convertir lluvia anual mezclada en riesgo de sequía.');
    comprobar(!str_contains(json_encode($datos['recomendaciones']), 'obligatorio'), 'No prescribir riego sin balance del ciclo.');
};
$pruebas['calendario sin fuente o provincia no inventa diciembre ni otra ubicación'] = static function (): void {
    $catalogo = ['calendario_siembra' => [['Zona / Provincia' => 'Guayas', 'DIC' => 'S']]];
    $datos = scenario([['rendimiento_estimado' => 5]], $catalogo, ['ubicacion' => 'Lugar desconocido','latitud'=>null,'longitud'=>null]);
    comprobar($datos['viabilidad_siembra'] === [] && $datos['kpis']['fecha_siembra_recomendada'] === null, 'No asignar provincia predeterminada.');
};
$pruebas['ventana real de catálogo conserva fuente y año bisiesto'] = static function (): void {
    $catalogo = ['calendario_siembra' => [['Zona / Provincia' => 'Guayas', 'FEB' => 'S']]];
    $datos = scenario([['rendimiento_estimado' => 5]], $catalogo, año: 2024);
    comprobar($datos['viabilidad_siembra'][0]['rango'] === '1–29 FEB' && $datos['viabilidad_siembra'][0]['fuente'] === 'Catálogo agronómico local', 'Conservar ventana y calendario civil.');
};
$pruebas['consulta filtra parcela y año antes de limitar registros'] = static function (): void {
    $repo = new Simulaciones([['cultivo_id' => 1, 'rendimiento_estimado' => 5], ['cultivo_id' => 2, 'rendimiento_estimado' => 9]]);
    $datos = (new ServicioAnaliticaScenario(new Catalogo(), new Cultivos(lote()), $repo))->construir(7, 1, 2025);
    comprobar($repo->consultas === [[7, 1, 50, 2025]] && $datos['simulaciones_count'] === 1, 'No usar colección global limitada para filtrar después.');
};
$pruebas['rechaza parcela ajena antes de consultar simulaciones'] = static function (): void {
    $repo = new Simulaciones();
    try {
        (new ServicioAnaliticaScenario(new Catalogo(), new Cultivos(lote(['usuario_id' => 8])), $repo))->construir(7, 1);
        throw new \RuntimeException('Debió rechazar parcela ajena.');
    } catch (AccesoDenegadoException) { comprobar($repo->consultas === [], 'No consultar simulaciones antes de autorización.'); }
};

$fallos = 0;
$pruebas['calendario de parcela conecta fechas conservadas sin confundir año de ejecución y campaña'] = static function (): void {
    $repo=new Simulaciones();
    $repo->ultima=['id'=>206,'fecha'=>'2026-11-09 10:00:00','escenarios_json'=>json_encode(['_zeasys_modelo'=>['trazabilidad'=>['calendario'=>['fecha_siembra'=>'2027-03-12','fecha_fin_estimada'=>'2027-07-12','origen_duracion'=>'Referencia del conjunto de entrenamiento']]]])];
    $datos=(new ServicioAnaliticaScenario(new Catalogo(),new Cultivos(lote(['fecha_siembra'=>'2027-03-12'])),$repo))->construir(7,1,2099);
    comprobar(($datos['año_ultima_simulacion']??null)===2026 && $datos['simulaciones_count']===0,'Ofrecer el año disponible sin mezclar sus resultados.');
    $events=$datos['calendario_parcela']['eventos']??[];
    comprobar(count($events)===2 && $events[0]['fecha']==='2027-03-12' && $events[1]['fecha']==='2027-07-12','Conectar siembra y fin estimado ya guardados.');
    comprobar($events[1]['tipo']==='fin_ciclo_estimado' && str_contains($events[1]['fuente'],'entrenamiento'),'No presentar fin estimado como cosecha observada.');
};
$pruebas['calendario de parcela no mezcla un fin de ciclo anterior con una nueva fecha de siembra'] = static function (): void {
    $repo=new Simulaciones();$repo->ultima=['id'=>2,'fecha'=>'2026-01-01','escenarios_json'=>json_encode(['_zeasys_modelo'=>['trazabilidad'=>['calendario'=>['fecha_siembra'=>'2026-02-01','fecha_fin_estimada'=>'2026-06-01']]]])];
    $datos=(new ServicioAnaliticaScenario(new Catalogo(),new Cultivos(lote(['fecha_siembra'=>'2027-03-12'])),$repo))->construir(7,1,2026);
    $events=$datos['calendario_parcela']['eventos']??[];
    comprobar(count($events)===1 && $events[0]['fecha']==='2027-03-12','Conservar sólo la fecha registrada de la campaña actual.');
};
$pruebas['Siembra resuelve la provincia por coordenadas antes de leer ventanas de catálogo'] = static function (): void {
    $catalogo=['calendario_siembra'=>[['Zona / Provincia'=>'Manabí','FEB'=>'S'],['Zona / Provincia'=>'Guayas','MAR'=>'S']]];
    $datos=scenario([['id'=>1,'rendimiento_estimado'=>4]],$catalogo,['latitud'=>-1,'longitud'=>-80,'ubicacion'=>'Guayas']);
    comprobar(($datos['cultivo_activo']['provincia']??null)==='Manabí' && $datos['kpis']['fecha_siembra_recomendada']==='Febrero','Las coordenadas deben resolver la referencia provincial.');
};
$pruebas['Siembra mantiene el calendario sin inventar rendimientos cuando el año no tiene simulaciones'] = static function (): void {
    $catalogo=['calendario_siembra'=>[['Zona / Provincia'=>'Manabí','FEB'=>'S']]];
    $datos=scenario([],$catalogo,['latitud'=>-1,'longitud'=>-80],2024);
    comprobar(count($datos['viabilidad_siembra']??[])===1 && $datos['viabilidad_siembra'][0]['rango']==='1–29 FEB','El calendario no depende de tener simulaciones.');
    comprobar($datos['kpis']['rendimiento_esperado']===null && $datos['percentiles']['p50']===null && $datos['simulaciones_count']===0,'Ausencia de muestra no es cero.');
};
$pruebas['Siembra separa las ventanas de maíz duro y suave de una misma provincia'] = static function (): void {
    $catalogo=['calendario_siembra'=>[['Zona / Provincia'=>'Loja','Tipo Maíz'=>'Maíz Duro Amarillo','MAR'=>'S'],['Zona / Provincia'=>'Loja','Tipo Maíz'=>'Maíz Suave / Blanco','MAY'=>'S']]];
    $datos=scenario([['id'=>1,'rendimiento_estimado'=>4]],$catalogo,['latitud'=>null,'longitud'=>null,'ubicacion'=>'Loja','tipo_maiz'=>'Suave Harinoso']);
    comprobar($datos['kpis']['fecha_siembra_recomendada']==='Mayo','No mezclar ventanas de familias distintas.');
};
$pruebas['Siembra rechaza parcelas inactivas antes de leer resultados'] = static function (): void {
    try {scenario([['id'=>1,'rendimiento_estimado'=>4]],[],['activo'=>0]);throw new \RuntimeException('Debió rechazar parcela inactiva.');}
    catch (AccesoDenegadoException) {}
};
foreach ($pruebas as $nombre => $prueba) {
    try { $prueba(); echo "[OK] {$nombre}\n"; }
    catch (\Throwable $e) { $fallos++; echo "[FAIL] {$nombre}: {$e->getMessage()}\n"; }
}
echo (count($pruebas) - $fallos) . ' passed, ' . $fallos . " failed\n";
exit($fallos ? 1 : 0);
