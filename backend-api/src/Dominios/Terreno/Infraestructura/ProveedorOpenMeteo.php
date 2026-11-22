<?php
// src/Dominios/Terreno/Infraestructura/ProveedorOpenMeteo.php — Open-Meteo Archive API: promedio de 30 días (cURL verbatim).
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

use ZeaSys\Dominios\Terreno\Dominio\ProveedorTemperaturaCampanaInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ConsultaConRespaldo;
use ZeaSys\Dominios\Terreno\Aplicacion\GradosDiaMaiz;

final class ProveedorOpenMeteo implements ProveedorClimaInterface, ProveedorTemperaturaCampanaInterface
{
    public function __construct(
        private ?CacheInterface $cache = null,
        private TransferenciasHttp $http = new TransferenciasHttp(),
        private string $urlArchivo = 'https://archive-api.open-meteo.com/v1/archive',
    ) {}
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array
    {
        // Treinta días completos del archivo reciente, con siete días de margen
        // por la demora de publicación. No representa la media de todo el cultivo.
        $fin = new \DateTimeImmutable('-7 days', new \DateTimeZone('America/Guayaquil'));
        $fechaFin = $fin->format('Y-m-d');
        $fechaInicio = $fin->modify('-29 days')->format('Y-m-d');
        $urlClima = $this->urlArchivo
            . "?latitude={$latitud}&longitude={$longitud}"
            . "&start_date={$fechaInicio}&end_date={$fechaFin}"
            . "&daily=temperature_2m_mean,temperature_2m_min,temperature_2m_max"
            .         ",precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max,shortwave_radiation_sum"
            .         ",et0_fao_evapotranspiration"
            . "&timezone=auto";

        $ch = curl_init($urlClima);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT      => 'AgroPredict/2.0'
        ]);
        $respuestaClima = $this->http->descargar([$ch])[0];

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

        // Acumulado reciente únicamente; no convertirlo en una lluvia anual.
        $valoresPrecip = $this->serie($datosDiarios, 'precipitation_sum');
        $fechas = $this->serie($datosDiarios, 'time');
        if (count($valoresPrecip) === 30 && count($fechas) === 30 && count(array_filter($valoresPrecip, static fn($v) => !is_bool($v) && is_numeric($v) && is_finite((float)$v) && $v >= 0)) === 30) {
            $actualizaciones['precipitacion_30d'] = round(array_sum($valoresPrecip), 1);
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

        // ET₀ de referencia FAO-56; acumulado y promedio de 30 días, solo si la serie está completa.
        $et0 = $this->serie($datosDiarios, 'et0_fao_evapotranspiration');
        $et0Validos = array_values(array_filter($et0, static fn($v) => is_numeric($v) && $v >= 0));
        $et0Completo = count($et0Validos) === 30 && count($et0) === 30 ? array_sum($et0Validos) : null;
        if ($et0Completo !== null) {
            $actualizaciones['et0_30d'] = round($et0Completo, 1);
        }

        // Serie diaria completa de los últimos 30 días; el frontend la grafica tal cual.
        $fechas = $this->serie($datosDiarios, 'time');
        $tMin = $this->serie($datosDiarios, 'temperature_2m_min');
        $tMax = $this->serie($datosDiarios, 'temperature_2m_max');
        $tempMedia = $this->serie($datosDiarios, 'temperature_2m_mean');
        $precipitacion = $this->serie($datosDiarios, 'precipitation_sum');
        $humedad = $this->serie($datosDiarios, 'relative_humidity_2m_mean');
        $serieDiaria = [];
        foreach ($fechas as $i => $fecha) {
            if (!is_string($fecha)) continue;
            $serieDiaria[] = [
                'fecha' => $fecha,
                'precip_mm' => isset($precipitacion[$i]) && is_numeric($precipitacion[$i]) ? (float) $precipitacion[$i] : null,
                'temp_media_c' => isset($tempMedia[$i]) && is_numeric($tempMedia[$i]) ? (float) $tempMedia[$i] : null,
                'temp_max_c' => isset($tMax[$i]) && is_numeric($tMax[$i]) ? (float) $tMax[$i] : null,
                'temp_min_c' => isset($tMin[$i]) && is_numeric($tMin[$i]) ? (float) $tMin[$i] : null,
                'et0_mm' => isset($et0[$i]) && is_numeric($et0[$i]) ? (float) $et0[$i] : null,
                'humedad_media_pct' => isset($humedad[$i]) && is_numeric($humedad[$i]) ? (float) $humedad[$i] : null,
            ];
        }
        if (count($serieDiaria) === 30) {
            $actualizaciones['serie_diaria_30d'] = $serieDiaria;
        }

        if ($actualizaciones !== []) $actualizaciones['periodo_30d'] = ['inicio'=>$fechaInicio,'fin'=>$fechaFin,'dias'=>30];
        return $actualizaciones;
    }

    /**
     * Paridad con el original (modo coercitivo): una serie null o no listada caía a [].
     *
     * @param array<string, mixed> $datosDiarios
     * @return array<int, mixed>
     */
    /**
     * Resumen mensual de los últimos 12 meses desde el archivo. Calcula totales
     * modelados de precipitación y temperatura. Un mes con lluvia incompleta
     * conserva null, sin contar los días faltantes como cero.
     */
    public function obtenerResumenMensual12Meses(float $latitud, float $longitud): ?array
    {
        $fin = (new \DateTimeImmutable('first day of this month', new \DateTimeZone('America/Guayaquil')))->setTime(0, 0);
        $fechaFin = $fin->modify('- 1 second')->format('Y-m-d');
        $fechaInicio = $fin->modify('first day of -12 months')->format('Y-m-d');
        $cacheKey = sprintf('clima_12m_v2_%.4f_%.4f_%s', $latitud, $longitud, $fin->format('Ym'));
        $cached = $this->cache?->obtener($cacheKey, 86400);
        if (is_array($cached)) return $cached;
        $url = $this->urlArchivo
            . "?latitude={$latitud}&longitude={$longitud}"
            . "&start_date={$fechaInicio}&end_date={$fechaFin}"
            . "&daily=precipitation_sum,temperature_2m_mean"
            . "&timezone=auto&models=era5";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_USERAGENT => 'ZeaSys/2.0 (resumen mensual 12 meses)',
        ]);
        $respuesta = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!is_string($respuesta) || $respuesta === '' || $status < 200 || $status >= 300) return null;
        $json = json_decode($respuesta, true);
        if (!is_array($json) || !isset($json['daily']) || !is_array($json['daily'])) return null;

        $summary = $this->resumirMeses($json['daily'], $fechaInicio, $fechaFin);
        if ($summary !== null) $this->cache?->guardar($cacheKey, $summary);
        return $summary;
    }

    private function resumirMeses(array $daily, string $fechaInicio, string $fechaFin): ?array
    {
        $fechas = $this->serie($daily, 'time');
        $precipitacion = $this->serie($daily, 'precipitation_sum');
        $temperaturaMedia = $this->serie($daily, 'temperature_2m_mean');

        $porMes = [];
        $seen = [];
        foreach ($fechas as $i => $fecha) {
            if (!is_string($fecha) || isset($seen[$fecha]) || $fecha < $fechaInicio || $fecha > $fechaFin) continue;
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);
            if ($date === false || $date->format('Y-m-d') !== $fecha) continue;
            $seen[$fecha] = true;
            $ym = substr($fecha, 0, 7);
            if (!isset($porMes[$ym])) {
                $porMes[$ym] = ['lluvia_mm' => 0.0, 'rain_count' => 0, 'temp_sum' => 0.0, 'temp_count' => 0, 'dias' => 0];
            }
            if (is_numeric($precipitacion[$i] ?? null) && is_finite((float) $precipitacion[$i]) && $precipitacion[$i] >= 0) {
                $porMes[$ym]['lluvia_mm'] += (float) $precipitacion[$i];
                $porMes[$ym]['rain_count']++;
            }
            if (is_numeric($temperaturaMedia[$i] ?? null) && is_finite((float) $temperaturaMedia[$i]) && $temperaturaMedia[$i] >= -90 && $temperaturaMedia[$i] <= 65) {
                $porMes[$ym]['temp_sum'] += (float) $temperaturaMedia[$i];
                $porMes[$ym]['temp_count']++;
            }
            $porMes[$ym]['dias']++;
        }
        ksort($porMes);
        $meses = [];
        foreach ($porMes as $ym => $info) {
            $expected = (int) (new \DateTimeImmutable($ym . '-01'))->format('t');
            $meses[] = [
                'ym' => $ym,
                'mes' => $ym,
                'precipitacion_mm' => $info['rain_count'] === $expected ? round($info['lluvia_mm'], 1) : null,
                'temp_media_c' => $info['temp_count'] > 0 ? round($info['temp_sum'] / $info['temp_count'], 1) : null,
                'dias' => $info['dias'],
                'dias_lluvia' => $info['rain_count'],
                'dias_temperatura' => $info['temp_count'],
                'dias_esperados' => $expected,
            ];
        }

        return $meses === [] ? null : [
            'meses' => $meses,
            'periodo' => ['inicio' => $fechaInicio, 'fin' => $fechaFin],
            'fuente' => 'Open-Meteo Archive · ERA5',
            'nota' => 'Historia reciente modelada por ERA5 para esta ubicación, no mediciones del lote. La lluvia mensual requiere todos los días; una media de temperatura puede tener cobertura parcial, indicada en dias_temperatura.',
        ];
    }

    public function gradosDia(float $lat, float $lon, string $inicio, string $fin): ?array
    {
        $clave = sprintf('gdd_v1_%.4f_%.4f_%s_%s', $lat, $lon, $inicio, $fin);
        $consultar = function () use ($lat, $lon, $inicio, $fin): array {
            $url = $this->urlArchivo . '?' . http_build_query([
                'latitude' => $lat, 'longitude' => $lon, 'start_date' => $inicio, 'end_date' => $fin,
                'daily' => 'temperature_2m_min,temperature_2m_max', 'models' => 'era5_land', 'timezone' => 'auto',
            ]);
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FAILONERROR => true, CURLOPT_TIMEOUT => 5, CURLOPT_CONNECTTIMEOUT => 2]);
            $json = json_decode((string) curl_exec($ch), true);
            curl_close($ch);
            if (!is_array($json['daily']['time'] ?? null)) return [];
            $producto = GradosDiaMaiz::calcular($json['daily'], $inicio, $fin);
            return $producto['dias_validos'] ? $producto : [];
        };
        $registro = $this->cache ? (new ConsultaConRespaldo($this->cache))->obtener($clave, 86400, 30 * 86400, $consultar)
            : ['datos' => $consultar(), 'consultado_utc' => gmdate('c'), 'estado' => 'actualizado'];
        return !$registro['datos'] ? null : $registro['datos'] + ['fuente' => 'Open-Meteo Archive · ERA5-Land',
            'resolucion' => '0,1° (aprox. 11 km)', 'consultado_utc' => $registro['consultado_utc'], 'estado' => $registro['estado']];
    }

    private function serie(array $datosDiarios, string $clave): array
    {
        $valores = $datosDiarios[$clave] ?? [];
        return is_array($valores) ? $valores : [];
    }
}
