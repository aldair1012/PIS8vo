<?php
// Regresiones de entrada de parcelas y simulaciones. Sin base de datos ni red.
// Uso: C:\xampp\php\php.exe tests/validacion/ejecutar.php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Dominios\Lotes\Aplicacion\CultivoService;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Lotes\Dominio\ValidadorLimitesEcuador;
use ZeaSys\Dominios\Simulaciones\Aplicacion\SimulacionService;
use ZeaSys\Dominios\Simulaciones\Dominio\GestorMotorIaInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\MotorPrediccionInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\RegistroExplicadores;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad;
use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EvaluadorCondiciones;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Dominios\Terreno\Dominio\AltitudPorCultivoInterface;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;

final class CultivosMemoria implements CultivoRepositoryInterface
{
    public int $escrituras = 0;
    public array $datos = [];
    public array $lote = [
        'id' => 1, 'usuario_id' => 7, 'nombre_parcela' => 'Lote original',
        'variedad_maiz' => 'Híbrido convencional', 'tipo_maiz' => 'Duro Amarillo',
        'ubicacion' => 'Manabí', 'area' => 1.0, 'latitud' => -1.0, 'longitud' => -80.0,
        'fecha_siembra' => '2026-01-02', 'geojson' => null, 'altitud' => null, 'ph' => 6.5,
        'fertilizacion_fecha' => null, 'fertilizacion_dosis' => null, 'fertilizacion_tipo' => 'Urea',
    ];
    public function crear(array $datos): int { $this->datos = $datos; $this->escrituras++; return 1; }
    public function actualizar(int $id, array $datos): bool { $this->datos = $datos; $this->escrituras++; return true; }
    public function obtenerPorId(int $id): ?array { return $id === 1 ? $this->lote : null; }
    public function obtenerPorUsuario(int $usuarioId): array { return [$this->lote]; }
    public function obtenerConCoordenadas(int $usuarioId): array { return [$this->lote]; }
    public function eliminar(int $id): bool { throw new RuntimeException('No debe eliminar datos.'); }
    public function contarPorUsuario(int $usuarioId): int { return 1; }
    public function areaTotalPorUsuario(int $usuarioId): float { return 1.0; }
}

final class SimulacionesMemoria implements SimulacionRepositoryInterface
{
    public int $escrituras = 0;
    public array $datos = [];
    public function guardar(array $datos, array $resultado): int { $this->datos = $datos; $this->escrituras++; return 2; }
    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null, int $desplazamiento = 0): array { return []; }
    public function obtenerAniosPorUsuario(int $usuarioId): array { return []; }
    public function obtenerPorId(int $id): ?array { return null; }
    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array { return []; }
    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array { return []; }
    public function obtenerRecientesPorCultivo(int $usuarioId, int $cultivoId, int $limite = 50, ?int $year = null): array { return []; }
    public function eliminar(int $id): bool { throw new RuntimeException('No debe eliminar datos.'); }
    public function contarPorUsuario(int $usuarioId): int { return 0; }
    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $año = null): ?array { return null; }
}

function comprobar(bool $condicion, string $mensaje): void
{
    if (!$condicion) throw new RuntimeException($mensaje);
}

function rechaza(callable $accion, string $campo): void
{
    try {
        $accion();
    } catch (ValidacionException $e) {
        comprobar($e->codigoHttp() === 400, 'La entrada inválida debe producir HTTP 400.');
        comprobar(str_contains($e->getMessage(), $campo), 'La validación debe identificar el campo ' . $campo);
        return;
    }
    throw new RuntimeException('No se rechazó el campo ' . $campo);
}

function peticion(array $datos): Peticion
{
    $p = new Peticion('POST');
    // Inyecta el cuerpo ya decodificado; evita levantar un servidor HTTP en esta suite unitaria.
    (new ReflectionProperty(Peticion::class, 'cuerpo'))->setValue($p, $datos);
    return $p;
}

$cultivos = new CultivosMemoria();
$simulaciones = new SimulacionesMemoria();
$cache = new class implements CacheInterface {
    public function obtener(string $clave, int $ttlSegundos = 86400): ?array { throw new RuntimeException('No debe consultar terreno.'); }
    public function guardar(string $clave, array $valor): void { throw new RuntimeException('No debe escribir caché.'); }
    public function limpiarExpirados(): void {}
};
$clima = new class implements ProveedorClimaInterface {
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array { throw new RuntimeException('No debe usar red.'); }
};
$suelo = new class implements ProveedorSueloInterface {
    public function obtenerSuelo(float $latitud, float $longitud): array { throw new RuntimeException('No debe usar red.'); }
};
$altitud = new class implements AltitudPorCultivoInterface {
    public function altitudPorCoordenadas(float $latitud, float $longitud): ?float { throw new RuntimeException('No debe consultar altitud.'); }
};
$motor = new class implements MotorPrediccionInterface {
    public int $llamadas = 0;
    public bool $contratoCampos = true;
    public array $ultimaEntrada = [];
    public function predecir(array $datos): array { $this->llamadas++; $this->ultimaEntrada=$datos; return ['success' => true, 'rendimiento_estimado' => 4.0, 'trazabilidad' => $this->contratoCampos ? ['contrato_campo'=>'1.0','suelo_ubicacion_utilizado'=>isset($datos['suelo_ubicacion'])] : []]; }
};
$gestor = new class implements GestorMotorIaInterface {
    public int $llamadas = 0;
    public function estaActivo(): bool { return true; }
    public function detallesSalud(): ?array { return []; }
    public function iniciar(): bool { throw new RuntimeException('No debe iniciar procesos.'); }
    public function asegurarActivo(int $maxWaitSeconds = 15): array { $this->llamadas++; return ['running' => true, 'message' => 'Doble de prueba']; }
    public function estado(bool $tryStart = false): array { return []; }
};
$servicioCultivos = new CultivoService($cultivos, new ValidadorLimitesEcuador(), new ServicioDatosTerreno($cache, $clima, $suelo, $altitud));
$explicabilidad = new ServicioExplicabilidad(new EvaluadorCondiciones(), new RegistroExplicadores(), new ResolutorContextoExplicacion($cultivos, $simulaciones));
$servicioSimulaciones = new SimulacionService($simulaciones, $motor, $gestor, $explicabilidad, $cache, $cultivos);
$parcelaValida = ['nombre_parcela' => 'Lote de prueba', 'area' => 1, 'latitud' => -1, 'longitud' => -80];
$simulacionValida = ['cultivo_id' => 1, 'temperatura' => 24, 'humedad' => 70, 'precipitacion' => 800, 'fertilizante' => 150, 'ph_suelo' => 6.2, 'area_simulada' => 1];
$pruebas = [];
$pruebas['parcela sin pH conserva la ausencia de datos'] = static function () use ($servicioCultivos, $cultivos, $parcelaValida): void {
    $servicioCultivos->crear(7, peticion(array_replace($parcelaValida, ['ph' => null, 'altitud' => null])));
    comprobar($cultivos->datos['ph'] === null && $cultivos->datos['altitud'] === null, 'No debe asignar pH ni altitud de ejemplo.');
};


foreach (['nombre_parcela', 'variedad_maiz', 'tipo_maiz', 'ubicacion', 'fertilizacion_tipo'] as $campo) {
    foreach (['lista vacía' => [], 'lista' => ['texto'], 'objeto' => new stdClass(), 'false' => false, 'true' => true, 'entero' => 1, 'decimal' => 1.5] as $tipo => $valor) {
        foreach (['crear', 'actualizar'] as $accion) {
            $pruebas["parcela {$accion}: rechaza {$campo} como {$tipo} antes de escribir"] = static function () use ($servicioCultivos, $cultivos, $parcelaValida, $campo, $valor, $accion): void {
                $antes = $cultivos->escrituras;
                $datos = array_replace($parcelaValida, ['id' => 1, $campo => $valor]);
                rechaza(static fn () => $servicioCultivos->$accion(7, peticion($datos)), $campo);
                comprobar($cultivos->escrituras === $antes, 'No debe persistir una parcela inválida.');
            };
        }
    }
}

foreach (['nombre', 'modelo_usado', 'tipo_suelo'] as $campo) {
    foreach (['lista vacía' => [], 'lista' => ['texto'], 'objeto' => new stdClass(), 'false' => false, 'true' => true, 'entero' => 1, 'decimal' => 1.5] as $tipo => $valor) {
        $pruebas["simulación: rechaza {$campo} como {$tipo} antes del motor y la escritura"] = static function () use ($servicioSimulaciones, $simulaciones, $motor, $gestor, $simulacionValida, $campo, $valor): void {
            $antes = [$simulaciones->escrituras, $motor->llamadas, $gestor->llamadas];
            rechaza(static fn () => $servicioSimulaciones->simular(7, peticion(array_replace($simulacionValida, [$campo => $valor]))), $campo);
            comprobar([$simulaciones->escrituras, $motor->llamadas, $gestor->llamadas] === $antes, 'No debe llamar al motor ni persistir una simulación inválida.');
        };
    }
}

foreach (['fecha_siembra', 'fertilizacion_fecha'] as $campo) {
    foreach (['2026-1-2', '2026-01-2', '2025-02-29', '2026-02-30', '2026-01-02T00:00:00', "2026-01-02\n", "2026-01-02\0", [], false] as $i => $valor) {
        foreach (['crear', 'actualizar'] as $accion) {
            $pruebas["parcela {$accion}: rechaza fecha {$campo} inválida #{$i}"] = static function () use ($servicioCultivos, $cultivos, $parcelaValida, $campo, $valor, $accion): void {
                $antes = $cultivos->escrituras;
                rechaza(static fn () => $servicioCultivos->$accion(7, peticion(array_replace($parcelaValida, ['id' => 1, $campo => $valor]))), $campo);
                comprobar($cultivos->escrituras === $antes, 'No debe guardar una fecha inválida.');
            };
        }
    }
}

$pruebas['parcela: conserva textos, recorte, fechas válidas y año bisiesto'] = static function () use ($servicioCultivos, $parcelaValida): void {
    $r = $servicioCultivos->crear(7, peticion(array_replace($parcelaValida, ['nombre_parcela' => '  Maíz de prueba  ', 'fecha_siembra' => '2024-02-29', 'fertilizacion_fecha' => '2026-01-02', 'fertilizacion_tipo' => ' Urea '])));
    comprobar($r['cultivo']['nombre_parcela'] === 'Maíz de prueba', 'Debe recortar el nombre.');
    comprobar($r['cultivo']['fecha_siembra'] === '2024-02-29' && $r['cultivo']['fertilizacion_fecha'] === '2026-01-02', 'Debe conservar las fechas válidas.');
    comprobar($r['cultivo']['fertilizacion_tipo'] === 'Urea', 'Debe recortar el tipo de fertilización.');
};
$pruebas['parcela: mantiene defaults y fechas opcionales vacías o null'] = static function () use ($servicioCultivos, $parcelaValida): void {
    foreach ([[], ['variedad_maiz' => null, 'tipo_maiz' => null, 'ubicacion' => null, 'fecha_siembra' => null, 'fertilizacion_fecha' => '', 'fertilizacion_tipo' => null]] as $opcionales) {
        $datos = $servicioCultivos->crear(7, peticion(array_replace($parcelaValida, $opcionales)))['cultivo'];
        comprobar($datos['variedad_maiz'] === 'Híbrido convencional' && $datos['tipo_maiz'] === 'Duro Amarillo' && $datos['ubicacion'] === '', 'Debe preservar defaults de textos omitidos o null.');
        comprobar($datos['fecha_siembra'] === null && $datos['fertilizacion_fecha'] === null && $datos['fertilizacion_tipo'] === null, 'Debe conservar los opcionales vacíos como null.');
    }
    foreach (['', '0'] as $valor) {
        $datos = $servicioCultivos->crear(7, peticion($parcelaValida + ['fertilizacion_tipo' => $valor]))['cultivo'];
        comprobar($datos['fertilizacion_tipo'] === null, 'Debe conservar el comportamiento previo del tipo de fertilización vacío.');
    }
};
$pruebas['parcela: actualizar conserva campos omitidos o null y permite vaciar fertilización'] = static function () use ($servicioCultivos, $cultivos): void {
    foreach ([['id' => 1], ['id' => 1, 'nombre_parcela' => null, 'variedad_maiz' => null, 'tipo_maiz' => null, 'ubicacion' => null, 'fertilizacion_tipo' => null]] as $entrada) {
        $datos = $servicioCultivos->actualizar(7, peticion($entrada))['cultivo'];
        foreach (['nombre_parcela', 'variedad_maiz', 'tipo_maiz', 'ubicacion', 'fertilizacion_tipo'] as $campo) comprobar($datos[$campo] === $cultivos->lote[$campo], 'Debe conservar ' . $campo);
    }
    comprobar($servicioCultivos->actualizar(7, peticion(['id' => 1, 'fertilizacion_tipo' => '']))['cultivo']['fertilizacion_tipo'] === '', 'Debe permitir vaciar el texto al actualizar.');
};
$pruebas['simulación: conserva defaults omitidos o null y guarda el resultado'] = static function () use ($servicioSimulaciones, $simulaciones, $simulacionValida): void {
    foreach ([[], ['nombre' => null, 'modelo_usado' => null, 'tipo_suelo' => null], ['nombre' => '  Ensayo válido  ']] as $opcionales) {
        $r = $servicioSimulaciones->simular(7, peticion(array_replace($simulacionValida, $opcionales)));
        comprobar($r['exito'] && $r['resultado']['simulacion_id'] === 2, 'Debe completar la simulación válida.');
        comprobar($simulaciones->datos['modelo_usado'] === 'xgboost' && $simulaciones->datos['tipo_suelo'] === 'franco', 'Debe conservar los defaults de modelo y suelo.');
        comprobar(isset($opcionales['nombre']) ? $simulaciones->datos['nombre'] === 'Ensayo válido' : str_starts_with($simulaciones->datos['nombre'], 'Simulación '), 'Debe conservar el nombre por defecto o recortar el recibido.');
    }
};

$pruebas['simulación: valida el área en servidor antes de llamar al motor'] = static function () use ($servicioSimulaciones, $simulacionValida, $simulaciones, $motor): void {
    foreach ([0, 0.001, 1.01] as $area) {
        $antes = [$motor->llamadas, $simulaciones->escrituras];
        rechaza(static fn () => $servicioSimulaciones->simular(7, peticion(array_replace($simulacionValida, ['area_simulada' => $area]))), 'área');
        comprobar([$motor->llamadas, $simulaciones->escrituras] === $antes, 'El área inválida no debe llegar al motor.');
    }
};
$pruebas['simulación: conserva cero de lluvia del ciclo y rechaza entradas inválidas'] = static function () use ($servicioSimulaciones, $simulacionValida, $simulaciones): void {
    $servicioSimulaciones->simular(7, peticion(array_replace($simulacionValida, ['precipitacion_ciclo_mm' => 0])));
    comprobar($simulaciones->datos['precipitacion_ciclo_mm'] === 0.0 && $simulaciones->datos['precipitacion'] === 0.0, 'Debe persistir el valor efectivo del ciclo, incluido cero.');
    foreach ([null, true, [], 'sin dato', -1, 4001] as $valor) {
        try {
            $servicioSimulaciones->simular(7, peticion(array_replace($simulacionValida, ['precipitacion_ciclo_mm' => $valor])));
            throw new RuntimeException('Debe rechazar la lluvia inválida.');
        } catch (ValidacionException $e) {
            comprobar($e->codigoHttp() === 400, 'Debe ser una validación controlada.');
        }
    }
};
$pruebas['simulación: transmite parámetros de campo y conserva ceros y fecha'] = static function () use ($servicioSimulaciones, $simulacionValida, $simulaciones): void {
    $servicioSimulaciones->simular(7, peticion([...$simulacionValida,'fecha_siembra'=>'2024-02-28','parametros_campo'=>['ciclo_dias'=>120,'lamina_riego_mm'=>0,'semilla_certificada'=>0,'riego_tipo'=>'temporal_lluvia']]));
    comprobar($simulaciones->datos['parametros_campo']['lamina_riego_mm'] === 0.0, 'Debe conservar cero de riego.');
    comprobar($simulaciones->datos['parametros_campo']['semilla_certificada'] === 0 && $simulaciones->datos['fecha_siembra'] === '2024-02-28', 'Debe conservar semilla y fecha válidas.');
};
$pruebas['simulación: no guarda si un motor anterior ignora campos nuevos'] = static function () use ($servicioSimulaciones, $simulacionValida, $simulaciones, $motor): void {
    $before=$simulaciones->escrituras; $motor->contratoCampos=false;
    try {
        $servicioSimulaciones->simular(7, peticion([...$simulacionValida,'parametros_campo'=>['ciclo_dias'=>120]]));
        throw new RuntimeException('No debe guardar datos que el motor ignoró.');
    } catch (\ZeaSys\Kernel\Errores\ServicioExternoException $e) {
        comprobar(str_contains($e->getMessage(),'versión anterior'), 'Debe explicar el reinicio necesario.');
        comprobar($simulaciones->escrituras === $before, 'No debe persistir una simulación incompleta.');
    } finally { $motor->contratoCampos=true; }
};
foreach ([['ciclo_dias'=>120.5],['lamina_riego_mm'=>true],['riego_tipo'=>'inventado'],['temperatura_min_c'=>50],['rendimiento_t_ha'=>12]] as $i=>$fields) {
    $pruebas['simulación: rechaza parámetro de campo inválido #'.$i] = static function () use ($servicioSimulaciones,$simulacionValida,$fields,$motor,$simulaciones): void {
        $before=[$motor->llamadas,$simulaciones->escrituras];
        try { $servicioSimulaciones->simular(7,peticion([...$simulacionValida,'parametros_campo'=>$fields])); throw new RuntimeException('Debe rechazar campos inválidos.'); }
        catch (ValidacionException $e) { comprobar([$motor->llamadas,$simulaciones->escrituras] === $before,'Debe validar antes de llamar al motor.'); }
    };
}
$pruebas['simulación: envía solo propiedades de suelo realmente recibidas del proveedor'] = static function () use ($servicioSimulaciones,$simulacionValida,$cache,$motor): void {
    $fakeCache=new class implements CacheInterface {
        public function obtener(string $clave,int $ttlSegundos=86400): ?array { return ['suelo_campos_api'=>['clay','sand','silt'],'suelo'=>['clay'=>29.4,'sand'=>40.4,'silt'=>30.1,'materia_organica'=>9.9]]; }
        public function guardar(string $clave,array $valor): void {}
        public function limpiarExpirados(): void {}
    };
    $property=new ReflectionProperty($servicioSimulaciones,'cache'); $property->setValue($servicioSimulaciones,$fakeCache);
    try {
        $servicioSimulaciones->simular(7,peticion([...$simulacionValida,'usar_suelo_ubicacion'=>true]));
        comprobar($motor->ultimaEntrada['suelo_ubicacion']['textura_arcilla_pct']===29.4,'Debe utilizar arcilla del mapa.');
        comprobar(!isset($motor->ultimaEntrada['suelo_ubicacion']['materia_organica_pct']),'Un valor de respaldo no debe enviarse como dato del proveedor.');
        comprobar($motor->ultimaEntrada['ubicacion']==='Manabí, Ecuador','La provincia se obtiene de las coordenadas para el motor.');
    } finally { $property->setValue($servicioSimulaciones,$cache); }
};
$pruebas['ubicación: no rellena mediciones de proveedores caídos con valores inventados'] = static function () use ($servicioCultivos): void {
    $p = peticion([]);
    (new ReflectionProperty(Peticion::class, 'consulta'))->setValue($p, ['id' => 1]);
    $r = $servicioCultivos->obtenerValoresUbicacion(7, $p);
    comprobar($r['temperatura'] === null && $r['humedad'] === null && $r['precipitacion'] === null && $r['tipo_suelo'] === null, 'Los valores no observados deben faltar.');
    comprobar($r['ph_suelo'] === 6.5 && $r['area_simulada'] === 1.0, 'Se conservan los valores registrados del lote.');
};

$fallos = 0;
foreach ($pruebas as $nombre => $prueba) {
    try {
        $prueba();
        echo "[OK] {$nombre}\n";
    } catch (Throwable $e) {
        $fallos++;
        echo "[FAIL] {$nombre}: {$e->getMessage()}\n";
    }
}
echo "\n" . (count($pruebas) - $fallos) . ' passed, ' . $fallos . " failed\n";
exit($fallos > 0 ? 1 : 0);
