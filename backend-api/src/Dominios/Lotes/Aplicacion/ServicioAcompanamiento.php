<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Lotes\Aplicacion;

use ZeaSys\Dominios\Lotes\Infraestructura\AcompanamientoRepository;

final class ServicioAcompanamiento
{
    public function __construct(private AcompanamientoRepository $repo) {}

    public function triaje(int $tecnico): array
    {
        $filas = $this->repo->compartidas($tecnico);
        $hoy = (new \DateTimeImmutable('today', new \DateTimeZone('America/Guayaquil')))->format('Y-m-d');
        foreach ($filas as &$fila) {
            $m = json_decode($fila['datos_json'] ?? '', true) ?? [];
            unset($fila['datos_json']);
            $fecha = $m['fecha_observacion'] ?? null;
            $enCampana = $fecha !== null && $fila['fecha_siembra'] !== null && $fecha >= $fila['fecha_siembra']
                && $fecha <= ($fila['fecha_cosecha'] ?? $hoy);
            if ($enCampana && $fecha > ($fila['ultima_observacion'] ?? '')) $fila['ultima_observacion'] = $fecha;
            $fila['rendimiento_observado_t_ha'] = $fila['fecha_cosecha'] ? (float) $fila['produccion_seca_kg'] / 1000 / (float) $fila['area_cosechada_ha'] : null;
            unset($fila['produccion_seca_kg'], $fila['area_cosechada_ha']);
            [$fila['orden'], $fila['estado'], $fila['motivo']] = match (true) {
                $fila['fecha_cosecha'] !== null && $fila['rendimiento_observado_t_ha'] === 0.0 => [0, 'Revisar pérdida', 'Cosecha declarada con cero kilogramos en superficie positiva.'],
                $fila['fecha_cosecha'] !== null => [4, 'Campaña cosechada', 'El productor registró el peso y la superficie cosechada.'],
                $enCampana && ($m['incidencia_pct'] ?? 0) > 0 => [0, 'Revisar incidencia', 'El productor declaró ' . $m['incidencia_pct'] . ' % de plantas afectadas el ' . $fecha . '.'],
                $fila['fecha_siembra'] === null => [1, 'Completar siembra', 'Falta la fecha para identificar la campaña actual.'],
                $fila['fecha_siembra'] > $hoy => [3, 'Siembra prevista', 'La fecha de siembra registrada es posterior a hoy.'],
                $fila['ultima_observacion'] === null => [1, 'Solicitar observación', 'La campaña actual aún carece de observaciones fechadas.'],
                default => [2, 'Seguimiento', 'Hay una observación fechada de la campaña en curso.'],
            };
        }
        unset($fila);
        usort($filas, static fn (array $a, array $b) => [$a['orden'], $a['nombre_parcela'], $a['id']] <=> [$b['orden'], $b['nombre_parcela'], $b['id']]);
        return $filas;
    }
}
