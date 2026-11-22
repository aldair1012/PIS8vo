<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Aplicacion;

final class GradosDiaMaiz
{
    // AGR-202, tabla 2: grados-día °F del híbrido de ejemplo, convertidos a °C al comparar.
    private const UMBRALES_F = ['V2' => 200, 'V6' => 475, 'V12' => 870, 'VT' => 1135, 'R1' => 1400, 'R6' => 2700];

    public static function calcular(array $serie, string $inicio, string $fin): array
    {
        $porFecha = [];
        foreach ($serie['time'] ?? [] as $i => $fecha) {
            if (!is_string($fecha) || $fecha < $inicio || $fecha > $fin || isset($porFecha[$fecha])) continue;
            $min = $serie['temperature_2m_min'][$i] ?? null;
            $max = $serie['temperature_2m_max'][$i] ?? null;
            if (!is_numeric($min) || !is_numeric($max) || $min > $max || $min < -90 || $max > 65) continue;
            $porFecha[$fecha] = max(0, (min(30, $max) + max(10, min(30, $min))) / 2 - 10);
        }
        $acumulado = 0.0;
        $dias = $validos = 0;
        $hitos = [];
        $ultimo = new \DateTimeImmutable($fin);
        for ($dia = new \DateTimeImmutable($inicio); $dia <= $ultimo; $dia = $dia->modify('+1 day')) {
            $dias++;
            $fecha = $dia->format('Y-m-d');
            if (!isset($porFecha[$fecha])) continue;
            $validos++;
            $acumulado += $porFecha[$fecha];
            if ($validos !== $dias) continue;
            foreach (self::UMBRALES_F as $etapa => $fahrenheit) {
                $umbral = $fahrenheit / 1.8;
                if (!isset($hitos[$etapa]) && $acumulado >= $umbral) {
                    $hitos[$etapa] = ['etapa' => $etapa, 'fecha' => $fecha, 'gdd_umbral' => round($umbral, 1)];
                }
            }
        }
        return ['inicio' => $inicio, 'fin' => $fin, 'dias_esperados' => $dias, 'dias_validos' => $validos,
            'gdd' => $validos === $dias && $dias > 0 ? round($acumulado, 1) : null,
            'gdd_parcial' => $validos ? round($acumulado, 1) : null, 'hitos' => array_values($hitos)];
    }
}
