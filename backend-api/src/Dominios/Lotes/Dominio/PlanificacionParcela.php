<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Lotes\Dominio;

use ZeaSys\Kernel\Errores\ValidacionException;

final class PlanificacionParcela
{
    /** Preserve unclassified legacy dates; never infer that a past plan happened. */
    public static function completar(array $entrada, array $actual, ?string $fecha): array
    {
        $tipo = array_key_exists('tipo_fecha_siembra', $entrada) ? $entrada['tipo_fecha_siembra'] : ($actual['tipo_fecha_siembra'] ?? null);
        if (!array_key_exists('tipo_fecha_siembra', $entrada) && $fecha !== ($actual['fecha_siembra'] ?? null)) $tipo = null;
        if ($tipo === '') $tipo = null;
        if ($tipo !== null && !in_array($tipo, ['prevista', 'real_declarada'], true)) throw new ValidacionException('Indica si la fecha es prevista o real declarada.');
        if ($fecha === null) $tipo = null;
        if ($tipo === 'real_declarada' && $fecha > (new \DateTimeImmutable('now', new \DateTimeZone('America/Guayaquil')))->format('Y-m-d')) throw new ValidacionException('Una siembra real declarada no puede tener una fecha futura.');

        $reglas = json_decode((string) file_get_contents(__DIR__.'/../../../../data/referencias/entradas-campo.json'), true, 512, JSON_THROW_ON_ERROR)['campos'];
        $ciclo = array_key_exists('ciclo_dias', $entrada) ? $entrada['ciclo_dias'] : ($actual['ciclo_dias'] ?? null);
        if ($ciclo === '') $ciclo = null;
        if ($ciclo !== null) {
            $entero = filter_var($ciclo, FILTER_VALIDATE_INT);
            if (is_bool($ciclo) || $entero === false || $entero < $reglas['ciclo_dias']['min'] || $entero > $reglas['ciclo_dias']['max']) throw new ValidacionException('La duración debe ser un número entero entre 1 y 730 días.');
            $ciclo = $entero;
        }
        $riego = array_key_exists('riego_tipo', $entrada) ? $entrada['riego_tipo'] : ($actual['riego_tipo'] ?? null);
        if ($riego === '') $riego = null;
        if ($riego !== null && (!is_string($riego) || !array_key_exists($riego, $reglas['riego_tipo']['opciones']))) throw new ValidacionException('Selecciona un sistema de agua o riego válido.');
        return ['tipo_fecha_siembra'=>$tipo, 'ciclo_dias'=>$ciclo, 'riego_tipo'=>$riego];
    }

    public static function fin(?string $fecha, ?int $dias): ?string
    {
        if ($fecha === null || $dias === null) return null;
        return (new \DateTimeImmutable($fecha))->modify('+'.($dias-1).' days')->format('Y-m-d');
    }
}
