<?php
// src/Dominios/Terreno/Infraestructura/ProveedorOpenMeteoForecast.php — Open-Meteo Forecast: clima actual y 7 días.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaActualInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

final class ProveedorOpenMeteoForecast implements ProveedorClimaActualInterface
{
    public function obtenerClimaActual(float $latitud, float $longitud, ?float $altitud = null): array
    {
        // La altitud permite que Open-Meteo ajuste la temperatura en la Sierra.
        // No se envía si no existe para no forzar una elevación inventada.
        $parametros = http_build_query([
            'latitude' => $latitud,
            'longitude' => $longitud,
            'current' => 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
            'daily' => 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code',
            'timezone' => 'auto',
            'forecast_days' => 7,
        ] + ($altitud !== null ? ['elevation' => $altitud] : []));

        $url = 'https://api.open-meteo.com/v1/forecast?' . $parametros;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT => 'ZeaSys/2.0 (clima actual de parcela)',
        ]);
        $respuesta = curl_exec($ch);
        $error = curl_error($ch);
        $estado = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!is_string($respuesta) || $estado < 200 || $estado >= 300) {
            $detalle = $estado > 0 ? "HTTP {$estado}" : 'sin respuesta';
            throw new ServicioExternoException("Open-Meteo Forecast no respondió ({$detalle})." . ($error !== '' ? " {$error}" : ''));
        }

        $json = json_decode($respuesta, true);
        $actual = is_array($json) ? ($json['current'] ?? null) : null;
        $diario = is_array($json) ? ($json['daily'] ?? null) : null;
        if (!is_array($actual) || !is_array($diario)) {
            throw new ServicioExternoException('Open-Meteo Forecast devolvió una respuesta inválida.');
        }

        $codigoActual = $this->entero($actual['weather_code'] ?? null);
        $pronostico = [];
        $fechas = is_array($diario['time'] ?? null) ? $diario['time'] : [];
        foreach ($fechas as $indice => $fecha) {
            $codigo = $this->entero($diario['weather_code'][$indice] ?? null);
            $pronostico[] = [
                'fecha' => (string) $fecha,
                'temp_max_c' => $this->numero($diario['temperature_2m_max'][$indice] ?? null),
                'temp_min_c' => $this->numero($diario['temperature_2m_min'][$indice] ?? null),
                'precipitacion_mm' => $this->numero($diario['precipitation_sum'][$indice] ?? null),
                'prob_precipitacion_pct' => $this->numero($diario['precipitation_probability_max'][$indice] ?? null),
                'codigo_tiempo' => $codigo,
                'descripcion' => $this->descripcion($codigo),
            ];
        }

        return [
            'disponible' => true,
            'fuente' => 'Open-Meteo Forecast',
            'consultado_en' => date('c'),
            'actual' => [
                'fecha_hora' => isset($actual['time']) ? (string) $actual['time'] : null,
                'temperatura_c' => $this->numero($actual['temperature_2m'] ?? null),
                'humedad_relativa_pct' => $this->numero($actual['relative_humidity_2m'] ?? null),
                'precipitacion_mm' => $this->numero($actual['precipitation'] ?? null),
                'viento_kmh' => $this->numero($actual['wind_speed_10m'] ?? null),
                'codigo_tiempo' => $codigoActual,
                'descripcion' => $this->descripcion($codigoActual),
            ],
            'pronostico_7d' => $pronostico,
        ];
    }

    private function numero(mixed $valor): ?float
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        return is_numeric($valor) ? round((float) $valor, 1) : null;
    }

    private function entero(mixed $valor): ?int
    {
        return is_numeric($valor) ? (int) $valor : null;
    }

    private function descripcion(?int $codigo): string
    {
        return match (true) {
            $codigo === 0 => 'Despejado',
            $codigo !== null && $codigo >= 1 && $codigo <= 3 => 'Parcialmente nublado',
            $codigo === 45 || $codigo === 48 => 'Niebla',
            $codigo !== null && $codigo >= 51 && $codigo <= 57 => 'Llovizna',
            $codigo !== null && $codigo >= 61 && $codigo <= 67 => 'Lluvia',
            $codigo !== null && $codigo >= 71 && $codigo <= 77 => 'Nieve',
            $codigo !== null && $codigo >= 80 && $codigo <= 82 => 'Chubascos',
            $codigo !== null && $codigo >= 85 && $codigo <= 86 => 'Chubascos de nieve',
            $codigo !== null && $codigo >= 95 => 'Tormenta eléctrica',
            default => 'Sin descripción',
        };
    }
}
