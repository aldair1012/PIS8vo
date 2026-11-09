<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield;
use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Dominios\Terreno\Dominio\AltitudPorCultivoInterface;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface;

final class CatalogoPrueba implements CatalogoAgronomicoInterface {
    public function __construct(private array $filas) {}
    public function cargar(): array { return ['variedades_por_zona' => $this->filas]; }
}
final class CultivosPrueba implements CultivoRepositoryInterface {
    public function __construct(private array $lote) {}
    public function obtenerPorId(int $id): ?array { return $this->lote; }
    public function crear(array $datos): int { return 1; }
    public function obtenerPorUsuario(int $usuarioId): array { return [$this->lote]; }
    public function obtenerConCoordenadas(int $usuarioId): array { return [$this->lote]; }
    public function actualizar(int $id, array $datos): bool { return false; }
    public function eliminar(int $id): bool { return false; }
    public function contarPorUsuario(int $usuarioId): int { return 1; }
    public function areaTotalPorUsuario(int $usuarioId): float { return 1; }
}
final class SimulacionesPrueba implements SimulacionRepositoryInterface {
    public function __construct(private bool $sinSimulaciones = false) {}
    public function obtenerRecientesPorCultivo(int $usuarioId, int $cultivoId, int $limite = 50, ?int $year = null): array {
        if ($this->sinSimulaciones) return [];
        return [['id' => 1, 'rendimiento_estimado' => 4, 'area_simulada' => 1, 'categoria_cosecha' => 'Baja', 'tipo_suelo' => 'franco']];
    }
    public function guardar(array $datos, array $resultado): int { return 1; }
    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null, int $desplazamiento = 0): array { return []; }
    public function obtenerAniosPorUsuario(int $usuarioId): array { return []; }
    public function obtenerPorId(int $id): ?array { return null; }
    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array { return []; }
    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array { return []; }
    public function eliminar(int $id): bool { return false; }
    public function contarPorUsuario(int $usuarioId): int { return 1; }
    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $año = null): ?array { return null; }
}
final class CachePrueba implements CacheInterface {
    public function __construct(private array $contexto) {}
    public function obtener(string $clave, int $ttlSegundos = 86400): ?array { return $this->contexto; }
    public function guardar(string $clave, array $valor): void {}
    public function limpiarExpirados(): void {}
}
final class ClimaNoConsultar implements ProveedorClimaInterface {
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array { throw new RuntimeException('La prueba debe usar la caché, sin red.'); }
}
final class SueloNoConsultar implements ProveedorSueloInterface {
    public function obtenerSuelo(float $latitud, float $longitud): array { throw new RuntimeException('La prueba debe usar la caché, sin red.'); }
}
final class AltitudPrueba implements AltitudPorCultivoInterface {
    public function altitudPorCoordenadas(float $latitud, float $longitud): ?float { return null; }
}

function construirPrueba(string $variedad, array $clima = [], bool $api = false, ?array $fichas = null, bool $coordenadas = true): array {
    $lote = ['usuario_id' => 7, 'activo' => true, 'variedad_maiz' => $variedad];
    if ($coordenadas) $lote += ['latitud' => -1.0, 'longitud' => -80.0];
    $catalogo = new CatalogoPrueba($fichas ?? [['Nombre / Código' => "INIAP H-603 'Superior'", 'Rendim. Promedio (t/ha)' => '9.7', 'Rendim. Máx. (t/ha)' => '12']]);
    $terreno = new ServicioDatosTerreno(new CachePrueba(['source' => 'Open-Meteo Archive', 'clima_disponible_api' => $api, 'clima' => $clima]), new ClimaNoConsultar(), new SueloNoConsultar(), new AltitudPrueba());
    return (new ServicioAnaliticaYield($catalogo, new CultivosPrueba($lote), new SimulacionesPrueba(), $terreno))->construir(7, 1);
}

$pruebas = [
    'reconoce la misma variedad con diferencias de comillas y guiones' => static function (): bool {
        return construirPrueba('INIAP H-603 Superior')['kpis']['rendimiento_maximo_catalogo'] === 12.0;
    },
    'no asigna una variedad específica a un híbrido genérico' => static function (): bool {
        return construirPrueba('Híbrido convencional')['kpis']['rendimiento_maximo_catalogo'] === null;
    },
    'no confunde una variante adaptada con la ficha original' => static function (): bool {
        return construirPrueba('INIAP H-603 Superior adaptado')['kpis']['rendimiento_maximo_catalogo'] === null;
    },
    'no elige arbitrariamente fichas duplicadas' => static function (): bool {
        $filas = [['Nombre / Código' => 'INIAP H-603 Superior', 'Rendim. Máx. (t/ha)' => 12], ['Nombre / Código' => "INIAP H-603 'Superior'", 'Rendim. Máx. (t/ha)' => 10]];
        return construirPrueba('INIAP H-603 Superior', fichas: $filas)['kpis']['rendimiento_maximo_catalogo'] === null;
    },
    'expone PAR de la API como contexto estimado con unidades y método' => static function (): bool {
        $datos = construirPrueba('Híbrido convencional', ['radiacion_par' => 42], true);
        return $datos['kpis']['radiacion_par_estimado'] === 42.0
            && $datos['referencias_contexto']['radiacion_par']['tipo'] === 'estimacion_desde_radiacion_solar'
            && $datos['referencias_contexto']['radiacion_par']['unidad'] === 'mol/m²/día';
    },
    'no publica un valor de respaldo como radiación de la API' => static function (): bool {
        return construirPrueba('Híbrido convencional', ['radiacion_par' => 42], false)['kpis']['radiacion_par_estimado'] === null;
    },
    'preserva radiación cero y descarta valores negativos o ausentes' => static function (): bool {
        return construirPrueba('Híbrido convencional', ['radiacion_par' => 0], true)['kpis']['radiacion_par_estimado'] === 0.0
            && construirPrueba('Híbrido convencional', ['radiacion_par' => -1], true)['kpis']['radiacion_par_estimado'] === null
            && construirPrueba('Híbrido convencional', [], true)['kpis']['radiacion_par_estimado'] === null;
    },
    'no reutiliza contexto geográfico si faltan coordenadas' => static function (): bool {
        return construirPrueba('Híbrido convencional', ['radiacion_par' => 42], true, coordenadas: false)['kpis']['radiacion_par_estimado'] === null;
    },
];
foreach ($pruebas as $nombre => $prueba) {
    if (!$prueba()) throw new RuntimeException('Falló: ' . $nombre);
    echo "OK: {$nombre}\n";
}
echo count($pruebas) . " pruebas correctas.\n";
