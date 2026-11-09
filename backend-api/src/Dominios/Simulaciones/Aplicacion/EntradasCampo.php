<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Simulaciones\Aplicacion;

use ZeaSys\Kernel\Errores\ValidacionException;

/** Campos adicionales compatibles con las columnas ya entrenadas. */
final class EntradasCampo
{
    public static function normalizar(array $data, array $parcela): array
    {
        $schema = json_decode((string) file_get_contents(__DIR__.'/../../../../data/referencias/entradas-campo.json'), true, 512, JSON_THROW_ON_ERROR);
        $fields = $data['parametros_campo'] ?? [];
        if (array_key_exists('parametros_campo', $data) && !is_array($data['parametros_campo'])) {
            throw new ValidacionException('Los parámetros de campo deben ser un objeto.');
        }
        $normalized = [];
        foreach ($fields as $key => $value) {
            $rule = $schema['campos'][$key] ?? null;
            if ($rule === null) throw new ValidacionException('Parámetro de campo no admitido: '.$key);
            if (!is_string($value) && !is_int($value) && !is_float($value)) throw new ValidacionException('Valor inválido para '.$key);
            if (isset($rule['opciones'])) {
                $option = (string) $value;
                if (!empty($rule['entero'])) {
                    if (!is_numeric($value) || !is_finite((float) $value) || floor((float) $value) !== (float) $value) throw new ValidacionException('Opción no válida para '.$key);
                    $option = (string) (int) $value;
                }
                if (!array_key_exists($option, $rule['opciones'])) throw new ValidacionException('Opción no válida para '.$key);
                $normalized[$key] = !empty($rule['entero']) ? (int) $value : $value;
                continue;
            }
            if (!is_numeric($value) || !is_finite((float) $value)) throw new ValidacionException('El campo '.$key.' debe ser numérico y finito.');
            $number = (float) $value;
            if ($number < $rule['min'] || $number > $rule['max'] || (!empty($rule['entero']) && floor($number) !== $number)) {
                throw new ValidacionException('Valor fuera del rango o formato admitido para '.$rule['label']);
            }
            $normalized[$key] = !empty($rule['entero']) ? (int) $number : $number;
        }
        $mean = (float) $data['temperatura'];
        if (($normalized['temperatura_min_c'] ?? $mean) > $mean || ($normalized['temperatura_max_c'] ?? $mean) < $mean) {
            throw new ValidacionException('La temperatura mínima debe ser menor o igual a la media, y la máxima mayor o igual.');
        }
        $out = [];
        if (array_key_exists('incluir_historico', $data)) {
            if (!is_bool($data['incluir_historico'])) throw new ValidacionException('La consulta de clima histórico debe ser un booleano.');
            $out['incluir_historico'] = $data['incluir_historico'];
        }
        if ($normalized !== []) $out['parametros_campo'] = $normalized;
        if (array_key_exists('plan_fertilizacion', $data) && is_array($data['plan_fertilizacion'])) {
            $out['plan_fertilizacion'] = $data['plan_fertilizacion'];
        }
        $start = $data['fecha_siembra'] ?? $parcela['fecha_siembra'] ?? null;
        if (array_key_exists('fecha_siembra', $data) && (!is_string($data['fecha_siembra']) || $data['fecha_siembra'] === '')) {
            throw new ValidacionException('La fecha de siembra debe ser una fecha válida AAAA-MM-DD u omitirse.');
        }
        if ($start !== null && $start !== '') {
            $date = is_string($start) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $start) === 1 ? \DateTimeImmutable::createFromFormat('!Y-m-d', $start) : false;
            if ($date === false || $date->format('Y-m-d') !== $start || $date->format('Y') < '1950' || $date->format('Y') > '2100') {
                throw new ValidacionException('La fecha de siembra debe ser válida y estar entre 1950 y 2100.');
            }
            $out['fecha_siembra'] = $start;
            $out['origen_fecha_siembra'] = array_key_exists('fecha_siembra', $data) ? 'Escenario del productor' : 'Fecha guardada de la parcela';
        }
        return $out;
    }
}
