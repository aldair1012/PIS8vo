<?php
// Regresiones del filtro temporal de simulaciones y su uso en explicaciones.
// Uso: C:\xampp\php\php.exe tests/simulaciones/ejecutar.php
// Dobles PDO: no requiere MySQL ni crea conexiones, procesos o datos reales.
declare(strict_types=1);

require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion;
use ZeaSys\Dominios\Simulaciones\Infraestructura\SimulacionRepositoryMysql;

final class PdoSimulaciones extends PDO
{
    public array $consultas = [];
    public function __construct(private array $respuestas) {}
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $indice = count($this->consultas);
        $this->consultas[] = ['sql' => $query, 'parametros' => null];
        return new SentenciaSimulaciones($this, $indice, $this->respuestas[$indice] ?? false);
    }
}

final class SentenciaSimulaciones extends PDOStatement
{
    public function __construct(private PdoSimulaciones $pdo, private int $indice, private array|false $fila) {}
    public function execute(?array $params = null): bool
    {
        $this->pdo->consultas[$this->indice]['parametros'] = $params;
        return true;
    }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed
    {
        return $this->fila;
    }
}

function comprobar(bool $condicion, string $mensaje): void
{
    if (!$condicion) throw new RuntimeException($mensaje);
}

function cultivosDePrueba(): CultivoRepositoryInterface
{
    return new class implements CultivoRepositoryInterface {
        public function obtenerPorId(int $id): ?array { return ['id' => $id, 'usuario_id' => 7, 'nombre_parcela' => 'Lote de prueba', 'area' => 1.0, 'ubicacion' => 'Manabí']; }
        public function crear(array $datos): int { throw new RuntimeException('No debe escribir parcelas.'); }
        public function obtenerPorUsuario(int $usuarioId): array { return []; }
        public function obtenerConCoordenadas(int $usuarioId): array { return []; }
        public function actualizar(int $id, array $datos): bool { throw new RuntimeException('No debe escribir parcelas.'); }
        public function eliminar(int $id): bool { throw new RuntimeException('No debe escribir parcelas.'); }
        public function contarPorUsuario(int $usuarioId): int { return 1; }
        public function areaTotalPorUsuario(int $usuarioId): float { return 1.0; }
    };
}

$fila = ['id' => 10, 'cultivo_id' => 1, 'fecha' => '2026-10-30 10:00:00', 'rendimiento_estimado' => 4.5, 'ph_suelo' => 5.8];
$pruebas = [];
$pruebas['año presente devuelve la simulación y mantiene parámetros ligados'] = static function () use ($fila): void {
    $pdo = new PdoSimulaciones([$fila]);
    $resultado = (new SimulacionRepositoryMysql($pdo))->obtenerUltimaPorCultivo(1, 2026);
    comprobar($resultado === $fila, 'Debe conservar la fila y todos sus campos.');
    comprobar(count($pdo->consultas) === 1, 'Debe ejecutar una sola consulta.');
    comprobar(str_contains($pdo->consultas[0]['sql'], 'fecha >= :inicio AND fecha < :fin'), 'Debe filtrar el año solicitado.');
    comprobar($pdo->consultas[0]['parametros'] === ['cultivo_id' => 1, 'inicio' => '2026-01-01 00:00:00', 'fin' => '2027-01-01 00:00:00'], 'Debe ligar el ID y el año.');
};
$pruebas['año sin registros devuelve null sin consultar otra campaña'] = static function () use ($fila): void {
    // La segunda respuesta reproduce la fila ajena al año que devolvía el fallback legacy.
    $pdo = new PdoSimulaciones([false, $fila]);
    $resultado = (new SimulacionRepositoryMysql($pdo))->obtenerUltimaPorCultivo(1, 2025);
    comprobar($resultado === null, 'No debe devolver una simulación de otro año.');
    comprobar(count($pdo->consultas) === 1, 'No debe ejecutar una consulta sin filtro como respaldo.');
};
$pruebas['sin filtro devuelve la última simulación de la parcela'] = static function () use ($fila): void {
    $pdo = new PdoSimulaciones([$fila]);
    $resultado = (new SimulacionRepositoryMysql($pdo))->obtenerUltimaPorCultivo(1);
    comprobar($resultado === $fila, 'Debe mantener el comportamiento sin filtro.');
    comprobar(count($pdo->consultas) === 1, 'Debe ejecutar una sola consulta.');
    comprobar(!str_contains($pdo->consultas[0]['sql'], 'YEAR('), 'No debe añadir filtro temporal si no se solicita.');
    comprobar($pdo->consultas[0]['parametros'] === ['cultivo_id' => 1], 'Solo debe ligar la parcela.');
    comprobar(str_contains($pdo->consultas[0]['sql'], 'ORDER BY fecha DESC LIMIT 1'), 'Debe conservar el orden de última simulación.');
};
$pruebas['sin filtro y sin registros devuelve null con una sola consulta'] = static function (): void {
    $pdo = new PdoSimulaciones([false]);
    comprobar((new SimulacionRepositoryMysql($pdo))->obtenerUltimaPorCultivo(1) === null, 'Una parcela sin simulaciones debe devolver null.');
    comprobar(count($pdo->consultas) === 1, 'No debe repetir una consulta idéntica sin registros.');
};
$pruebas['resolutor conserva contexto explícito cuando el año no tiene simulación'] = static function () use ($fila): void {
    $pdo = new PdoSimulaciones([false, $fila]);
    $resolutor = new ResolutorContextoExplicacion(cultivosDePrueba(), new SimulacionRepositoryMysql($pdo));
    $contexto = $resolutor->construir(['cultivo_id' => 1, 'año' => 2025, 'rendimiento_estimado' => 3.25, 'ph_suelo' => 6.4]);
    comprobar($contexto['rend_predicho'] === 3.25, 'No debe reemplazar el rendimiento explícito con el de otra campaña.');
    comprobar($contexto['ph_suelo'] === 6.4, 'No debe reutilizar el pH de otra campaña.');
    comprobar(count($pdo->consultas) === 1 && $pdo->consultas[0]['parametros']['inicio'] === '2025-01-01 00:00:00' && $pdo->consultas[0]['parametros']['fin'] === '2026-01-01 00:00:00', 'El resolutor debe respetar el filtro solicitado.');
};
$pruebas['resolutor usa la simulación del año cuando está disponible'] = static function () use ($fila): void {
    $pdo = new PdoSimulaciones([$fila]);
    $contexto = (new ResolutorContextoExplicacion(cultivosDePrueba(), new SimulacionRepositoryMysql($pdo)))->construir(['cultivo_id' => 1, 'año' => 2026]);
    comprobar($contexto['rend_predicho'] === 4.5 && $contexto['ph_suelo'] === 5.8, 'Debe usar los datos guardados de la campaña seleccionada.');
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
