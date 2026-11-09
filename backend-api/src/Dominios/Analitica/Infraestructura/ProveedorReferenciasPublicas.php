<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Infraestructura;

use ZeaSys\Dominios\Analitica\Dominio\ReferenciasRendimientoInterface;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;

final class ProveedorReferenciasPublicas implements ReferenciasRendimientoInterface
{
    private const PROFUNDIDADES = ['0-5cm' => 5, '5-15cm' => 10, '15-30cm' => 15, '30-60cm' => 30, '60-100cm' => 40];

    public function __construct(private CacheInterface $cache) {}

    public function obtener(array $cultivo): array
    {
        $resultado = [];
        if (($cultivo['tipo_maiz'] ?? '') !== 'Duro Amarillo') {
            return ['estado' => 'Las referencias externas integradas corresponden a maíz para grano; este tipo requiere una ficha específica.'];
        }
        $fichas = json_decode((string) file_get_contents(__DIR__ . '/../../../../data/referencias/variedades-verificadas.json'), true);
        $normalizar = static fn (string $valor): string => preg_replace('/[^a-z0-9]+/', '', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $valor) ?: $valor)) ?? '';
        foreach (($fichas['variedades'] ?? []) as $ficha) {
            if ($normalizar((string) ($cultivo['variedad_maiz'] ?? '')) === $normalizar($ficha['nombre'])) {
                $resultado['maximo_ensayo_variedad'] = ['valor' => $ficha['maximo_t_ha'], 'unidad' => 't/ha', 'fuente' => $ficha['fuente'], 'url' => $ficha['url'], 'tipo' => 'referencia_experimental_publicada', 'nota' => $ficha['ensayos'] . '. Máximo: ' . $ficha['condiciones_maximo'] . '. ' . $ficha['nota']];
                $resultado['promedio_ensayo_variedad'] = ['valor' => $ficha['promedio_t_ha'], 'unidad' => 't/ha', 'fuente' => $ficha['fuente'], 'url' => $ficha['url'], 'tipo' => 'referencia_experimental_publicada', 'nota' => $ficha['nota']];
            }
        }
        $resultado['etapa_sensible_referencia'] = [
            'valor' => 'Floración', 'unidad' => '', 'fuente' => 'FAO · respuesta del maíz al agua',
            'url' => 'https://www.fao.org/4/X5647E/x5647e0e.htm',
            'tipo' => 'referencia_agronomica',
            'nota' => 'La floración tiene Ky = 1,5 en la referencia FAO. Describe sensibilidad al déficit hídrico; no afirma que la parcela esté floreciendo ni diagnostica plagas.',
        ];
        if (!empty($cultivo['fecha_siembra'])) {
            $hoy = new \DateTimeImmutable('today', new \DateTimeZone('America/Guayaquil'));
            $fecha = \DateTimeImmutable::createFromFormat('!Y-m-d', substr((string) $cultivo['fecha_siembra'], 0, 10), new \DateTimeZone('America/Guayaquil'));
            if ($fecha) {
                $dias = (int) $fecha->diff($hoy)->format('%r%a');
                $resultado['situacion_siembra'] = ['valor' => $dias < 0 ? 'Fecha estimada futura' : $dias . ' días desde la fecha estimada', 'unidad' => '', 'fuente' => 'Fecha estimada registrada en la parcela', 'tipo' => 'calculo_desde_fecha_estimada', 'nota' => 'Fecha: ' . $fecha->format('d/m/Y') . '. No confirma que la siembra haya ocurrido ese día ni constituye una observación fenológica.'];
            }
        }
        if (!is_numeric($cultivo['latitud'] ?? null) || !is_numeric($cultivo['longitud'] ?? null)) return $resultado;
        $lat = (float) $cultivo['latitud'];
        $lon = (float) $cultivo['longitud'];
        if (abs($lat) > 90 || abs($lon) > 180 || !is_finite($lat) || !is_finite($lon)) return $resultado;

        $climaSiembra = $this->climaDesdeSiembraEstimada($cultivo, $lat, $lon);
        if ($climaSiembra !== null) $resultado += $climaSiembra;
        $lluviaInamhi = $this->historicoLluviaInamhi($lat, $lon);
        if ($lluviaInamhi !== null) $resultado['lluvia_historica_inamhi'] = $lluviaInamhi;

        $ruta = __DIR__ . '/../../../../data/referencias/gaez-v4-ecuador-maiz.json';
        $datos = is_file($ruta) ? json_decode((string) file_get_contents($ruta), true) : null;
        if (is_array($datos)) {
            foreach (['potencial', 'alcanzable'] as $nombre) {
                $capa = $datos['capas'][$nombre] ?? [];
                $valor = self::pixel($capa, $lat, $lon);
                if ($valor !== null) {
                    $resultado[$nombre . '_zonal'] = [
                        'valor' => round($valor / 1000, 3), 'unidad' => 't MS/ha',
                        'fuente' => 'FAO/IIASA GAEZ v4', 'url' => $datos['documentacion'],
                        'tipo' => 'referencia_modelada_zonal', 'periodo' => $datos['clima_base'],
                        'resolucion' => '5 minutos de arco (aprox. 9 km)',
                        'supuestos' => $capa['supuestos'], 'variable' => $capa['variable'],
                        'archivo_fuente' => $capa['url'], 'sha256' => $capa['sha256'],
                        'consultado_utc' => $datos['consultado_utc'],
                        'nota' => $datos['nota'],
                    ];
                }
            }
            if (isset($resultado['potencial_zonal'], $resultado['alcanzable_zonal'])) {
                $resultado['diferencia_zonal'] = [
                    'valor' => round($resultado['potencial_zonal']['valor'] - $resultado['alcanzable_zonal']['valor'], 3),
                    'unidad' => 't MS/ha', 'fuente' => 'FAO/IIASA GAEZ v4', 'url' => $datos['documentacion'],
                    'periodo' => $datos['clima_base'], 'tipo' => 'diferencia_de_referencias_modeladas',
                    'nota' => 'Potencial agroclimático de referencia menos alcanzable de secano del mismo periodo. Ambas cifras expresan materia seca. No compara la predicción ML con grano seco ni cuantifica una pérdida de la parcela.',
                ];
            }
        }
        $agua = $this->aguaPerfil($lat, $lon);
        if ($agua !== null) $resultado['agua_perfil'] = $agua;
        return $resultado;
    }

    public static function pixel(array $capa, float $lat, float $lon): ?int
    {
        if (!isset($capa['origen_oeste'], $capa['origen_norte'], $capa['paso_longitud'], $capa['paso_latitud']) || $capa['paso_longitud'] <= 0 || $capa['paso_latitud'] <= 0) return null;
        $x = (int) floor(($lon - $capa['origen_oeste']) / $capa['paso_longitud']);
        $y = (int) floor(($capa['origen_norte'] - $lat) / $capa['paso_latitud']);
        if ($x < 0 || $y < 0 || $x >= ($capa['columnas'] ?? 0) || $y >= ($capa['filas'] ?? 0)) return null;
        $valor = $capa['valores_kg_ms_ha'][$y][$x] ?? null;
        return is_int($valor) && $valor >= 0 ? $valor : null;
    }

    public static function capacidadPerfil(array $capas): ?float
    {
        $total = 0.0;
        foreach (self::PROFUNDIDADES as $profundidad => $espesorCm) {
            $fc = $capas['wv0033'][$profundidad] ?? null;
            $wp = $capas['wv1500'][$profundidad] ?? null;
            if (!is_numeric($fc) || !is_numeric($wp) || $fc < $wp || $wp < 0 || $fc > 1000) return null;
            // Mapas: 10^-3 cm³/cm³. Espesor en cm × 10 = espesor en mm.
            $total += (($fc - $wp) / 1000) * ($espesorCm * 10);
        }
        return round($total, 1);
    }

    private function aguaPerfil(float $lat, float $lon): ?array
    {
        $clave = 'precision_data_yield_agua_v1_' . round($lat, 4) . '_' . round($lon, 4);
        $cache = $this->cache->obtener($clave, 86400);
        if ($cache !== null && (($cache['valor'] ?? null) !== null || time() < ($cache['reintentar'] ?? 0))) return isset($cache['valor']) ? $cache : null;
        $urls = [];
        foreach (['wv0033', 'wv1500'] as $propiedad) {
            foreach (self::PROFUNDIDADES as $profundidad => $_) {
                $layer = $propiedad . '_' . $profundidad . '_mean';
                $urls[$propiedad . ':' . $profundidad] = 'https://maps.isric.org/mapserv?' . http_build_query([
                    'map' => '/map/' . $propiedad . '.map', 'SERVICE' => 'WMS', 'VERSION' => '1.1.1',
                    'REQUEST' => 'GetFeatureInfo', 'LAYERS' => $layer, 'QUERY_LAYERS' => $layer,
                    'STYLES' => '', 'SRS' => 'EPSG:4326', 'BBOX' => implode(',', [$lon - .0001, $lat - .0001, $lon + .0001, $lat + .0001]),
                    'WIDTH' => 3, 'HEIGHT' => 3, 'X' => 1, 'Y' => 1, 'INFO_FORMAT' => 'application/geo+json',
                ]);
            }
        }
        $respuestas = $this->consultar($urls);
        $capas = [];
        foreach ($respuestas as $claveCapa => $json) {
            [$propiedad, $profundidad] = explode(':', $claveCapa);
            $datos = json_decode($json ?? '', true);
            $valor = $datos['features'][0]['properties']['pixel_value'] ?? null;
            if (is_numeric($valor)) $capas[$propiedad][$profundidad] = (float) $valor;
        }
        $agua = self::capacidadPerfil($capas);
        if ($agua === null) {
            $this->cache->guardar($clave, ['valor' => null, 'reintentar' => time() + 3600]);
            return null;
        }
        $resultado = [
            'valor' => $agua, 'unidad' => 'mm', 'fuente' => 'ISRIC SoilGrids · perfil 0–100 cm',
            'url' => 'https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html',
            'formula_url' => 'https://www.fao.org/4/x0490e/x0490e0e.htm',
            'tipo' => 'capacidad_estimada_de_perfil', 'resolucion' => '250 m', 'profundidad_cm' => 100,
            'consultado_utc' => gmdate('c'), 'capas_valores_originales' => $capas,
            'metodo' => 'Suma por capa de (theta33 − theta1500) × espesor. Valores originales divididos por 1000.',
            'nota' => 'Capacidad disponible entre 33 y 1500 kPa del perfil de referencia de un metro. Mapas modelados; no es humedad actual, profundidad de raíces medida ni balance hídrico de toda la campaña.',
        ];
        $this->cache->guardar($clave, $resultado);
        return $resultado;
    }

    /** Acumulados meteorológicos desde la fecha ESTIMADA de siembra de la parcela. */
    private function climaDesdeSiembraEstimada(array $cultivo, float $lat, float $lon): ?array
    {
        $textoOriginal = trim((string) ($cultivo['fecha_siembra'] ?? ''));
        if ($textoOriginal === '') return ['clima_desde_siembra_estado' => 'La parcela no tiene una fecha estimada de siembra guardada.'];
        $textoFecha = substr($textoOriginal, 0, 10);
        $fecha = \DateTimeImmutable::createFromFormat('!Y-m-d', $textoFecha, new \DateTimeZone('America/Guayaquil'));
        if (!$fecha || $fecha->format('Y-m-d') !== $textoFecha) return ['clima_desde_siembra_estado' => 'No se pudo leer la fecha estimada de siembra guardada.'];

        $hoy = new \DateTimeImmutable('today', new \DateTimeZone('America/Guayaquil'));
        if ($fecha > $hoy) return ['clima_desde_siembra_estado' => 'La fecha estimada de siembra aún es futura; todavía no hay un periodo que acumular.'];
        if ($fecha < $hoy->modify('-365 days')) return ['clima_desde_siembra_estado' => 'La fecha estimada tiene más de 365 días. Actualízala en Parcelas para consultar un nuevo ciclo.'];

        $cacheKey = 'yield_ifs_sowing_v1_' . round($lat, 4) . '_' . round($lon, 4) . '_' . $fecha->format('Ymd');
        $cached = $this->cache->obtener($cacheKey, 21600);
        if ($cached !== null) return $cached;

        $url = 'https://archive-api.open-meteo.com/v1/archive?' . http_build_query([
            'latitude' => $lat,
            'longitude' => $lon,
            'start_date' => $fecha->format('Y-m-d'),
            'end_date' => $hoy->format('Y-m-d'),
            'daily' => 'precipitation_sum,et0_fao_evapotranspiration',
            'timezone' => 'America/Guayaquil',
            'models' => 'ecmwf_ifs',
        ], '', '&', PHP_QUERY_RFC3986);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_USERAGENT => 'ZeaSys/2.0 (agricultural data integration)',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (!is_string($body) || $status !== 200) return ['clima_desde_siembra_estado' => 'Open-Meteo no está disponible para consultar el periodo de esta parcela.'];

        $decoded = json_decode($body, true);
        $daily = is_array($decoded) ? ($decoded['daily'] ?? null) : null;
        if (!is_array($daily) || !is_array($daily['time'] ?? null)) return ['clima_desde_siembra_estado' => 'Open-Meteo no devolvió una serie diaria válida para ese periodo.'];

        $expectedDays = (int) $fecha->diff($hoy)->format('%a') + 1;
        $series = [
            'precipitacion_desde_siembra' => ['key' => 'precipitation_sum', 'values' => []],
            'et0_desde_siembra' => ['key' => 'et0_fao_evapotranspiration', 'values' => []],
        ];
        foreach ($series as &$item) {
            $rawValues = $daily[$item['key']] ?? [];
            if (!is_array($rawValues)) continue;
            foreach ($rawValues as $index => $raw) {
                $value = $this->decimal($raw);
                $day = $daily['time'][$index] ?? null;
                if ($value === null || $value < 0 || !is_string($day)) continue;
                $item['values'][] = ['fecha' => $day, 'valor' => $value];
            }
        }
        unset($item);

        $references = [];
        $coverageInsufficient = false;
        foreach ($series as $key => $item) {
            $validDays = count($item['values']);
            $coverage = $expectedDays > 0 ? $validDays / $expectedDays : 0.0;
            $first = $validDays ? $item['values'][0]['fecha'] : null;
            $last = $validDays ? $item['values'][$validDays - 1]['fecha'] : null;
            $isEt0 = $key === 'et0_desde_siembra';
            if ($coverage < 0.9) $coverageInsufficient = true;
            $references[$key] = [
                'valor' => $validDays > 0 && $coverage >= 0.9
                    ? round(array_sum(array_column($item['values'], 'valor')), 1)
                    : null,
                'unidad' => 'mm',
                'fuente' => 'Open-Meteo Historical · ECMWF IFS',
                'tipo' => 'acumulado_meteorologico_modelado',
                'periodo' => $first && $last ? $first . ' a ' . $last . ' · ' . $validDays . '/' . $expectedDays . ' días disponibles' : null,
                'resolucion' => 'Aproximadamente 9 km',
                'nota' => 'Suma diaria desde la fecha estimada de siembra guardada en la parcela. No confirma que la siembra ocurriera ese día. ' . ($coverage < 0.9 ? 'Cobertura menor a 90%; por eso no se publica un acumulado.' : '') . ($isEt0 ? 'ET₀ es evapotranspiración de referencia, no consumo medido del maíz (ETc).' : 'Es reanálisis meteorológico por coordenadas, no una lectura de pluviómetro en el lote.'),
                'dias_disponibles' => $validDays,
                'dias_del_periodo' => $expectedDays,
            ];
        }
        if ($coverageInsufficient) $references['clima_desde_siembra_estado'] = 'La cobertura de días de Open-Meteo es menor a 90%; no se publica un acumulado parcial como si fuera el periodo completo.';

        $this->cache->guardar($cacheKey, $references);
        return $references;
    }

    /** Serie anual INAMHI de la estación cercana; no rellena meses sin dato. */
    private function historicoLluviaInamhi(float $lat, float $lon): ?array
    {
        $cacheKey = 'yield_inamhi_rain_v1_' . round($lat, 3) . '_' . round($lon, 3);
        $cached = $this->cache->obtener($cacheKey, 604800);
        if ($cached !== null) return $cached;

        $path = __DIR__ . '/../../../../../ml-engine/data/inamhi-precipitacion-2019diciembre.csv';
        $handle = @fopen($path, 'rb');
        if ($handle === false) return null;
        $headers = fgetcsv($handle, null, ';');
        if (!is_array($headers)) {
            fclose($handle);
            return null;
        }
        $columns = array_flip(array_map(static fn (string $value): string => trim($value, "\xEF\xBB\xBF \t\n\r\0\x0B"), $headers));
        $months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        foreach (['Estacion', 'NombreEstacion', 'longitud2', 'latitud2', 'año', ...$months] as $required) {
            if (!isset($columns[$required])) {
                fclose($handle);
                return null;
            }
        }

        $stations = [];
        while (($row = fgetcsv($handle, null, ';')) !== false) {
            $code = trim((string) ($row[$columns['Estacion']] ?? ''));
            $stationLat = $this->decimal($row[$columns['latitud2']] ?? null);
            $stationLon = $this->decimal($row[$columns['longitud2']] ?? null);
            $year = filter_var(trim((string) ($row[$columns['año']] ?? '')), FILTER_VALIDATE_INT);
            if ($code === '' || $stationLat === null || $stationLon === null || $year === false || $year < 2000 || $year > 2019) continue;

            if (!isset($stations[$code])) {
                $rawName = (string) ($row[$columns['NombreEstacion']] ?? '');
                $name = iconv('ISO-8859-1', 'UTF-8//IGNORE', $rawName);
                $stations[$code] = [
                    'codigo' => $code,
                    'nombre' => $name !== false ? trim($name) : trim($rawName),
                    'latitud' => $stationLat,
                    'longitud' => $stationLon,
                    'años' => [],
                ];
            }
            if (isset($stations[$code]['años'][$year])) continue;
            $values = [];
            foreach ($months as $month) $values[] = $this->decimal($row[$columns[$month]] ?? null);
            $stations[$code]['años'][$year] = $values;
        }
        fclose($handle);
        if ($stations === []) return null;

        $qualified = [];
        $fallback = [];
        foreach ($stations as $station) {
            if (abs($station['latitud']) > 90 || abs($station['longitud']) > 180) continue;
            $distance = $this->distanciaKm($lat, $lon, $station['latitud'], $station['longitud']);
            if ($distance > 100) continue;
            $completeYears = 0;
            foreach ($station['años'] as $values) {
                if (count(array_filter($values, static fn (?float $value): bool => $value !== null)) === 12) $completeYears++;
            }
            if ($completeYears > 0) $fallback[] = ['station' => $station, 'distance' => $distance, 'complete' => $completeYears];
            if ($completeYears >= 8) $qualified[] = ['station' => $station, 'distance' => $distance, 'complete' => $completeYears];
        }
        if ($qualified !== []) {
            usort($qualified, static fn (array $a, array $b): int => $a['distance'] <=> $b['distance']);
            $selected = $qualified[0];
            $selection = 'Estación más cercana dentro de 100 km con al menos ocho años de doce meses reportados';
        } elseif ($fallback !== []) {
            usort($fallback, static fn (array $a, array $b): int => $b['complete'] <=> $a['complete'] ?: $a['distance'] <=> $b['distance']);
            $selected = $fallback[0];
            $selection = 'Estación cercana con más años de doce meses reportados; la cobertura puede ser limitada';
        } else {
            return null;
        }

        $byYear = $selected['station']['años'];
        $series = [];
        $completeYears = 0;
        for ($year = 2000; $year <= 2019; $year++) {
            $values = $byYear[$year] ?? array_fill(0, 12, null);
            $validMonths = count(array_filter($values, static fn (?float $value): bool => $value !== null));
            $annual = $validMonths === 12 ? round(array_sum($values), 1) : null;
            if ($annual !== null) $completeYears++;
            $series[] = ['año' => $year, 'precipitacion_mm' => $annual, 'meses_reportados' => $validMonths];
        }

        $result = [
            'estacion' => $selected['station']['nombre'],
            'codigo_estacion' => $selected['station']['codigo'],
            'distancia_km' => round($selected['distance'], 1),
            'fuente' => 'INAMHI · serie mensual local del proyecto',
            'archivo_fuente' => 'ml-engine/data/inamhi-precipitacion-2019diciembre.csv',
            'tipo' => 'observaciones_mensuales_estacion',
            'periodo' => '2000–2019',
            'unidad' => 'mm/año',
            'años_con_12_meses' => $completeYears,
            'criterio_estacion' => $selection,
            'serie' => $series,
            'nota' => 'Cada total es la suma de los doce valores mensuales publicados. Si falta un mes, el total anual queda vacío; los meses ausentes nunca se cuentan como cero. Es una estación meteorológica de referencia, no un pluviómetro instalado en la parcela.',
        ];
        $this->cache->guardar($cacheKey, $result);
        return $result;
    }

    private function decimal(mixed $value): ?float
    {
        if (!is_scalar($value) || trim((string) $value) === '') return null;
        $number = str_replace(',', '.', trim((string) $value));
        return is_numeric($number) && is_finite((float) $number) ? (float) $number : null;
    }

    private function distanciaKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $a = deg2rad($lat2 - $lat1);
        $b = deg2rad($lon2 - $lon1);
        $h = sin($a / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($b / 2) ** 2;
        return 6371 * 2 * asin(min(1, sqrt($h)));
    }

    private function consultar(array $urls): array
    {
        $multi = curl_multi_init();
        curl_multi_setopt($multi, CURLMOPT_MAX_HOST_CONNECTIONS, 3);
        $handles = [];
        foreach ($urls as $clave => $url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_USERAGENT => 'ZeaSys/2.0 (agricultural data integration)']);
            $handles[$clave] = $ch;
            curl_multi_add_handle($multi, $ch);
        }
        do {
            curl_multi_exec($multi, $pendientes);
            if ($pendientes) curl_multi_select($multi, .2);
        } while ($pendientes);
        $resultado = [];
        foreach ($handles as $clave => $ch) {
            $resultado[$clave] = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200 ? curl_multi_getcontent($ch) : null;
            curl_multi_remove_handle($multi, $ch);
            curl_close($ch);
        }
        curl_multi_close($multi);
        return $resultado;
    }
}
