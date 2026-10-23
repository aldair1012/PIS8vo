<?php
// src/Dominios/Terreno/Infraestructura/ProveedorOpenMeteo.php — Open-Meteo Archive API: promedio de 30 días (cURL verbatim).
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

final class ProveedorOpenMeteo implements ProveedorClimaInterface
{
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array
    {
        // API de Open-Meteo — Promedio histórico de los últimos 30 días
        // Se usa /v1/archive en lugar de /v1/forecast para obtener la temperatura
        // MEDIA del ciclo agrícola en vez del valor instantáneo (que varía hora a hora).
        $fechaFin   = date('Y-m-d');
        $fechaInicio = date('Y-m-d', strtotime('-30 days'));
        $urlClima = "https://archive-api.open-meteo.com/v1/archive"
            . "?latitude={$latitud}&longitude={$longitud}"
            . "&start_date={$fechaInicio}&end_date={$fechaFin}"
            . "&daily=temperature_2m_mean,temperature_2m_min,temperature_2m_max"
            .         ",precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max,shortwave_radiation_sum"
            . "&timezone=auto";

        $ch = curl_init($urlClima);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT      => 'AgroPredict/2.0'
        ]);
        $respuestaClima = curl_exec($ch);
        curl_close($ch);

        if (!$respuestaClima) {
            throw new ServicioExternoException('Open-Meteo Archive API sin respuesta.');
        }

        $jsonClima = json_decode($respuestaClima, true);
        if (!$jsonClima || !isset($jsonClima['daily']) || !is_array($jsonClima['daily'])) {
            throw new ServicioExternoException('Open-Meteo Archive API con respuesta inválida.');
        }

        $datosDiarios = $jsonClima['daily'];
        $actualizaciones = [];

        // --- Temperatura media: promedio de los últimos 30 días ---
        $temperaturasMedias = array_filter($this->serie($datosDiarios, 'temperature_2m_mean'), fn($v) => $v !== null);
        $temperaturasMinimas  = array_filter($this->serie($datosDiarios, 'temperature_2m_min'), fn($v) => $v !== null);
        if (!empty($temperaturasMedias)) {
            $actualizaciones['temperatura'] = round(array_sum($temperaturasMedias) / count($temperaturasMedias), 1);
        }
        if (!empty($temperaturasMinimas)) {
            $actualizaciones['temperatura_suelo'] = round(array_sum($temperaturasMinimas) / count($temperaturasMinimas) - 0.5, 1);
        }
        // Sin mínimas: temperatura_suelo = temperatura - 1.5 lo resuelve ServicioDatosTerreno (líneas 145–147 del original).

        // --- Humedad media ---
        $valoresHumedad = array_filter($this->serie($datosDiarios, 'relative_humidity_2m_mean'), fn($v) => $v !== null);
        if (!empty($valoresHumedad)) {
            $actualizaciones['humedad'] = round(array_sum($valoresHumedad) / count($valoresHumedad), 1);
        }

        // --- Precipitación: suma real de los 30 días, escalada a mm/año ---
        $valoresPrecip = array_filter($this->serie($datosDiarios, 'precipitation_sum'), fn($v) => $v !== null);
        if (!empty($valoresPrecip)) {
            $precipTotal30d = array_sum($valoresPrecip);          // mm en 30 días
            $precipAnualEstimada = round($precipTotal30d * 12.0, 1);   // proyección anual
            // `precipitacion` conserva la estimación anual porque los cálculos
            // agronómicos existentes la usan como lluvia de campaña. El valor
            // realmente medido en los últimos 30 días se expone aparte para no
            // etiquetarlo como si fuera un acumulado mensual.
            $actualizaciones['precipitacion_30d'] = round($precipTotal30d, 1);
            $actualizaciones['precipitacion'] = max(200.0, min(3500.0, $precipAnualEstimada));
        }

        // --- Viento ---
        $valoresViento = array_filter($this->serie($datosDiarios, 'wind_speed_10m_max'), fn($v) => $v !== null);
        if (!empty($valoresViento)) {
            $actualizaciones['viento'] = round(array_sum($valoresViento) / count($valoresViento), 1);
        }

        // Open-Meteo entrega radiación solar de onda corta en MJ/m²/día.
        // Aproximamos PAR con la fracción fotosintéticamente activa (0.45) y
        // 4.57 µmol/J: 1 MJ/m² equivale aproximadamente a 2.06 mol PAR/m².
        // La unidad queda explícita para que el dashboard no confunda PAR con W/m².
        $radiacionSolar = array_filter($this->serie($datosDiarios, 'shortwave_radiation_sum'), fn($v) => $v !== null);
        if (!empty($radiacionSolar)) {
            $promedioRadiacionSolar = array_sum($radiacionSolar) / count($radiacionSolar);
            $actualizaciones['radiacion_par'] = round(max(0.0, $promedioRadiacionSolar * 2.06), 1);
        }

        return $actualizaciones;
    }

    /**
     * Paridad con el original (modo coercitivo): una serie null o no listada caía a [].
     *
     * @param array<string, mixed> $datosDiarios
     * @return array<int, mixed>
     */
    private function serie(array $datosDiarios, string $clave): array
    {
        $valores = $datosDiarios[$clave] ?? [];
        return is_array($valores) ? $valores : [];
    }
}
