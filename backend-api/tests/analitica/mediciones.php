<?php
declare(strict_types=1);
require __DIR__ . '/ejecutar.php';

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioMedicionesRendimiento;
use ZeaSys\Dominios\Analitica\Dominio\MedicionesRendimientoRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class MedicionesPrueba implements MedicionesRendimientoRepositoryInterface {
    public array $datos = [];
    public function obtener(int $usuarioId, int $cultivoId): array { return ['datos' => $this->datos]; }
    public function guardar(int $usuarioId, int $cultivoId, array $datos): void { $this->datos = $datos; }
}
$repo = new MedicionesPrueba();
$servicio = new ServicioMedicionesRendimiento(new CultivosPrueba(['usuario_id' => 7, 'activo' => true]), $repo);
$servicio->guardar(7, 1, ['grano_seco_kg' => 2, 'biomasa_seca_kg' => 5, 'fecha_cosecha' => '2025-01-01']);
$resultado = $servicio->guardar(7, 1, ['capacidad_campo_pct' => 30, 'marchitez_pct' => 10, 'profundidad_cm' => 100, 'fecha_suelo' => '2025-01-01']);
if (($resultado['indicadores']['indice_cosecha']['valor'] ?? null) !== 0.4 || ($resultado['indicadores']['agua_medida']['valor'] ?? null) !== 200.0) throw new RuntimeException('Se perdió un grupo previo.');
$resultado = $servicio->guardar(7, 1, ['grano_seco_kg' => '', 'biomasa_seca_kg' => '', 'fecha_cosecha' => '']);
if (isset($resultado['indicadores']['indice_cosecha']) || !isset($resultado['indicadores']['agua_medida'])) throw new RuntimeException('El borrado de un grupo afectó a otro.');
try { $servicio->guardar(8, 1, ['profundidad_cm' => 50]); throw new RuntimeException('Se permitió acceso ajeno.'); } catch (AccesoDenegadoException) {}
try { $servicio->guardar(7, 1, ['fecha_suelo' => "2025-01-01\0"]); throw new RuntimeException('Se permitió una fecha inválida.'); } catch (ValidacionException) {}
$analitica = new ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield(new CatalogoPrueba([]), new CultivosPrueba(['usuario_id' => 7, 'activo' => true]), new SimulacionesPrueba(true), null, null, $servicio);
$sinSimulaciones = $analitica->construir(7, 1);
if (!isset($sinSimulaciones['mediciones_campo']['indicadores']['agua_medida'])) throw new RuntimeException('Las mediciones no se devuelven sin simulaciones.');
echo "OK: mediciones sin simulaciones\n";
echo "OK: mediciones parciales, borrado por grupo, aislamiento y fecha inválida\n";

