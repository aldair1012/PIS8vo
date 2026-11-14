<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Infraestructura;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;

/** Promedio de totales anuales completos; jamás extrapola un mes ni una campaña. */
final class ProveedorLluviaAnual implements \ZeaSys\Dominios\Terreno\Dominio\ProveedorLluviaAnualInterface
{
    public const INAMHI_URL = 'https://www.datosabiertos.gob.ec/dataset/eaa8894f-68d1-4a15-80f8-1a6f528f946c/resource/98c77d18-e863-4e00-8a22-eb47f2981d9c';
    public function __construct(private CacheInterface $cache, private ?\Closure $consultar = null) {}

    public function obtenerParaParcela(array $parcela): ?array
    {
        $lat = $parcela['latitud'] ?? null; $lon = $parcela['longitud'] ?? null;
        $origen = ['tipo'=>'coordenadas_parcela'];
        if (!is_numeric($lat) || !is_numeric($lon)) {
            $texto = trim((string)($parcela['ubicacion'] ?? ''));
            if ($texto === '') return null;
            $key = 'rain_city_v1_'.hash('sha256', $texto);
            $cached = $this->cache->obtener($key, 604800);
            if ($cached !== null) $punto = $cached['punto'] ?? null;
            else {
                if ($this->cache->obtener($key.'_fallo',900) !== null) return null;
                $partes = preg_split('/[,;|]/u', $texto);
                $ciudad = trim($partes[0]);
                $consulta = isset($partes[1]) ? $ciudad.', '.trim($partes[1]) : $ciudad;
                $json = $this->json('https://geocoding-api.open-meteo.com/v1/search?'.http_build_query(['name'=>$consulta,'count'=>10,'language'=>'es','countryCode'=>'EC','format'=>'json']));
                $normal = static fn($v) => strtolower(trim(iconv('UTF-8','ASCII//TRANSLIT//IGNORE',(string)$v) ?: (string)$v));
                $matches = array_values(array_filter($json['results'] ?? [], static fn($r) => ($r['country_code'] ?? '') === 'EC' && $normal($r['name'] ?? '') === $normal($ciudad)));
                $punto = count($matches) === 1 ? $matches[0] : null;
                if ($punto !== null) $this->cache->guardar($key, ['punto'=>$punto]);
                else $this->cache->guardar($key.'_fallo', ['sin_localidad_univoca'=>true]);
            }
            if (!is_array($punto)) return null;
            $lat=$punto['latitude'] ?? null; $lon=$punto['longitude'] ?? null;
            $origen=['tipo'=>'centro_localidad_aproximado','nombre'=>$punto['name'] ?? '', 'fuente'=>'Open-Meteo Geocoding · GeoNames', 'nota'=>'Centro de localidad; marca la parcela en el mapa para una referencia más cercana.'];
        }
        if (!is_numeric($lat) || !is_numeric($lon)) return null;
        $result=$this->obtener((float)$lat,(float)$lon);
        if ($result === null) return null;
        $result['ubicacion_referencia']=$origen+['latitud'=>(float)$lat,'longitud'=>(float)$lon];
        return $result;
    }

    public function obtener(float $lat, float $lon): ?array
    {
        if (!is_finite($lat) || !is_finite($lon) || abs($lat)>90 || abs($lon)>180) return null;
        $key='rain_annual_v3_'.round($lat,4).'_'.round($lon,4);
        $cached=$this->cache->obtener($key,604800);
        if ($cached !== null && isset($cached['valor'])) return $cached;
        if ($this->cache->obtener($key.'_fallo',900) !== null) return null;
        $station=$this->historicoLluviaInamhi($lat,$lon);
        if (($station['años_con_12_meses'] ?? 0)>=8) {
            $totals=array_column(array_filter($station['serie'],static fn($r)=>$r['precipitacion_mm']!==null),'precipitacion_mm');
            $result=$station+['valor'=>round(array_sum($totals)/count($totals),1), 'años_completos'=>count($totals),'metodo'=>'Promedio de totales de años con doce meses reportados'];
        } else {
            $json=$this->json('https://archive-api.open-meteo.com/v1/archive?'.http_build_query(['latitude'=>$lat,'longitude'=>$lon,'start_date'=>'1991-01-01','end_date'=>'2020-12-31','daily'=>'precipitation_sum','models'=>'era5','timezone'=>'America/Guayaquil']));
            $result=self::desdeDiarios($json);
        }
        if ($result === null) { $this->cache->guardar($key.'_fallo',['sin_referencia'=>true]); return null; }
        $result['consultado_utc']=gmdate('c');
        $result['ubicacion_referencia']=['tipo'=>'coordenadas_parcela','latitud'=>$lat,'longitud'=>$lon];
        $result['uso']='Referencia histórica por ubicación; no es lluvia del ciclo, pronóstico ni medición del lote.';
        $this->cache->guardar($key,$result);
        return $result;
    }

    public static function desdeDiarios(?array $json): ?array
    {
        if (($json['daily_units']['precipitation_sum'] ?? null)!=='mm') return null;
        $dates=$json['daily']['time'] ?? []; $values=$json['daily']['precipitation_sum'] ?? [];
        if (!is_array($dates) || !is_array($values) || count($dates)!==count($values)) return null;
        $years=[]; $seen=[];
        foreach ($dates as $i=>$date) {
            if (!is_string($date) || !preg_match('/^(19[9][0-9]|20[01][0-9]|2020)-[0-9]{2}-[0-9]{2}$/D',$date)) continue;
            $d=\DateTimeImmutable::createFromFormat('!Y-m-d',$date);
            if (!$d || $d->format('Y-m-d')!==$date || $date<'1991-01-01') continue;
            if (isset($seen[$date])) return null;
            $seen[$date]=true; $v=$values[$i];
            if (is_bool($v) || !is_numeric($v) || !is_finite((float)$v) || $v<0) continue;
            $years[(int)substr($date,0,4)][$date]=(float)$v;
        }
        $series=[]; $totals=[];
        for ($year=1991;$year<=2020;$year++) {
            $days=$years[$year] ?? []; $expected=(int)(new \DateTimeImmutable($year.'-12-31'))->format('z')+1;
            $annual=count($days)===$expected ? round(array_sum($days),1) : null;
            if ($annual!==null) $totals[]=$annual;
            $series[]=['año'=>$year,'precipitacion_mm'=>$annual,'dias_disponibles'=>count($days)];
        }
        // No publicar un promedio parcial como la referencia completa de treinta años.
        if (count($totals)!==30) return null;
        return ['valor'=>round(array_sum($totals)/30,1),'unidad'=>'mm/año','fuente'=>'Open-Meteo Historical · ERA5','url'=>'https://open-meteo.com/en/docs/historical-weather-api','tipo'=>'reanalisis_historico','periodo'=>'1991–2020','años_completos'=>30,'resolucion'=>'0,25° (aproximadamente 25 km)','metodo'=>'Promedio de treinta totales anuales completos a partir de precipitación diaria','serie'=>$series,'nota'=>'Estimación de reanálisis meteorológico; no es una observación de estación INAMHI ni un pronóstico de la campaña.'];
    }

    private function json(string $url): ?array
    {
        try {
            if ($this->consultar !== null) return ($this->consultar)($url);
            $ch=curl_init($url);
            curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_USERAGENT=>'ZeaSys/2.0 (historical rainfall)']);
            $body=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
            if ($status!==200 || !is_string($body)) return null;
            $data=json_decode($body,true); return is_array($data)?$data:null;
        } catch (\Throwable) { return null; }
    }
    /** Serie anual INAMHI de la estación cercana; no rellena meses sin dato. */
    public function historicoLluviaInamhi(float $lat, float $lon): ?array
    {
        $cacheKey = 'rain_inamhi_v2_' . round($lat, 4) . '_' . round($lon, 4);
        $cached = $this->cache->obtener($cacheKey, 604800);
        if ($cached !== null) return $cached;

        $path = __DIR__ . '/../../../../../ml-engine/data/inamhi-precipitacion-2019diciembre.csv';
        $hash = is_file($path) ? hash_file('sha256', $path) : false;
        if ($hash !== 'f3ccb2c1b18f20d2add3b0274d910cc125cf1bab66a476e15ef5178ae580356f') return null;
        $handle = @fopen($path, 'rb');
        if ($handle === false) return null;
        $headers = fgetcsv($handle, null, ';');
        if (!is_array($headers)) {
            fclose($handle);
            return null;
        }
        $columns = array_flip(array_map(static fn (string $value): string => trim($value, "\xEF\xBB\xBF \t\n\r\0\x0B"), $headers));
        if (isset($columns['anio'])) $columns['año'] = $columns['anio'];
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
            foreach ($months as $month) { $v = $this->decimal($row[$columns[$month]] ?? null); $values[] = $v !== null && $v >= 0 ? $v : null; }
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
            'sha256' => $hash,
            'sha256_fuente_original' => '1a7740828032630f26eec7e0e68443b50cc5ede06cd7a2164856bf442c0526fd',
            'transformacion' => 'Subconjunto de filas oficiales entre 2000 y 2019; valores mensuales conservados sin modificación',
            'url' => self::INAMHI_URL,
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

}
