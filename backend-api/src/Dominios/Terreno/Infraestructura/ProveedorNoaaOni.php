<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;

/** Keeps the existing service name for compatibility. NOAA uses RONI for official monitoring since February 2026. */
final class ProveedorNoaaOni
{
    public const URL = 'https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt';
    private const KEY = 'enso_roni_v2';

    public function __construct(private CacheInterface $cache, private ?string $urlOverride = null, private ?\DateTimeImmutable $reloj = null) {}

    public function obtenerOni(): ?array
    {
        $cached = $this->cache->obtener(self::KEY, 86400);
        if (is_array($cached) && isset($cached['trimestre'], $cached['valor_indice'])) {
            $cached['desde_cache'] = true;
            $cached['vigente'] = $this->reciente((string) ($cached['fin_periodo'] ?? ''));
            return $cached;
        }
        if ($this->cache->obtener(self::KEY . '_fallo', 900) !== null) return null;
        $url = $this->urlOverride ?? (getenv('ZEASYS_RONI_URL') ?: (getenv('ZEASYS_ONI_URL') ?: self::URL));
        $raw = $this->descargar($url);
        $series = is_string($raw) ? $this->parsear($raw) : [];
        if (count($series) < 6) {
            $this->cache->guardar(self::KEY . '_fallo', ['sin_datos_validos' => true]);
            return null;
        }
        $series = array_slice($series, -12);
        $last = $series[count($series) - 1];
        $value = $last['valor'];
        $n = 0;
        $direction = $value >= .5 ? 1 : ($value <= -.5 ? -1 : 0);
        $previousMonth = null;
        foreach (array_reverse($series) as $row) {
            if ($row['indice'] !== $last['indice'] || $direction === 0 || $row['valor'] * $direction < .5 || ($previousMonth !== null && $row['mes_ordinal'] !== $previousMonth - 1)) break;
            $n++;
            $previousMonth = $row['mes_ordinal'];
        }
        $index = $last['indice'];
        $result = [
            'indice' => $index, 'valor_indice' => round($value, 2),
            'roni' => $index === 'RONI' ? round($value, 2) : null,
            'oni' => $index === 'ONI' ? round($value, 2) : null,
            'trimestre' => $last['trimestre'], 'etiqueta_trimestre' => $last['etiqueta'],
            'periodo' => $last['trimestre'], 'fin_periodo' => $last['fin_periodo'],
            'vigente' => $this->reciente($last['fin_periodo']),
            'estado' => $direction === 1 ? 'anomalia_calida' : ($direction === -1 ? 'anomalia_fria' : 'sin_anomalia_marcada'),
            'estado_texto' => $direction === 1 ? 'Anomalía cálida del Pacífico tropical' : ($direction === -1 ? 'Anomalía fría del Pacífico tropical' : 'Sin anomalía marcada en este índice'),
            'consecutivos' => $n, 'criterio_historico_cumplido' => $n >= 5,
            // A threshold applied to one ocean index is not an official ENSO advisory.
            'episodio_declarado' => false,
            'serie' => $series, 'fuente' => "NOAA Climate Prediction Center · {$index} (ERSSTv6)",
            'fuente_corta' => "NOAA CPC · {$index}",
            'url' => $index === 'RONI' ? self::URL : 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
            'consultado_utc' => $this->ahora()->format('c'), 'desde_cache' => false,
            'nota' => 'Referencia trimestral del Pacífico tropical, no un pronóstico para la parcela. El criterio histórico de cinco períodos solapados no sustituye un aviso oficial que evalúe océano y atmósfera. Los valores recientes de RONI pueden revisarse durante dos meses.',
            'tipo' => 'indice_oceanico_trimestral',
        ];
        $this->cache->guardar(self::KEY, $result);
        return $result;
    }

    private function ahora(): \DateTimeImmutable { return $this->reloj ?? new \DateTimeImmutable('now', new \DateTimeZone('UTC')); }
    private function reciente(string $end): bool
    {
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $end, new \DateTimeZone('UTC'));
        return $date !== false && $date <= $this->ahora() && $date >= $this->ahora()->modify('-150 days');
    }
    private function descargar(string $url): ?string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_USERAGENT => 'ZeaSys/2.0 (NOAA regional climate reference)']);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return is_string($response) && ((parse_url($url, PHP_URL_SCHEME) === 'file') || ($status >= 200 && $status < 300)) ? $response : null;
    }
    private function parsear(string $raw): array
    {
        $labels = ['DJF' => 'Dic–Feb', 'JFM' => 'Ene–Mar', 'FMA' => 'Feb–Abr', 'MAM' => 'Mar–May', 'AMJ' => 'Abr–Jun', 'MJJ' => 'May–Jul', 'JJA' => 'Jun–Ago', 'JAS' => 'Jul–Sep', 'ASO' => 'Ago–Oct', 'SON' => 'Sep–Nov', 'OND' => 'Oct–Dic', 'NDJ' => 'Nov–Ene'];
        $endMonths = ['DJF' => 2, 'JFM' => 3, 'FMA' => 4, 'MAM' => 5, 'AMJ' => 6, 'MJJ' => 7, 'JJA' => 8, 'JAS' => 9, 'ASO' => 10, 'SON' => 11, 'OND' => 12, 'NDJ' => 1];
        $rows = [];
        foreach (preg_split('/\R/', $raw) ?: [] as $line) {
            $parts = preg_split('/\s+/', trim($line));
            if (!is_array($parts) || !in_array(count($parts), [3, 4], true)) continue;
            [$season, $year] = $parts;
            $season = strtoupper($season);
            $anomaly = $parts[count($parts) - 1];
            if (!isset($labels[$season]) || !ctype_digit($year) || (int) $year < 1950 || (int) $year > 2100 || !is_numeric($anomaly) || !is_finite((float) $anomaly) || abs((float) $anomaly) > 10) continue;
            $endYear = (int) $year + ($season === 'NDJ' ? 1 : 0);
            $month = $endMonths[$season];
            $end = new \DateTimeImmutable(sprintf('%04d-%02d-01', $endYear, $month), new \DateTimeZone('UTC'));
            $end = $end->modify('last day of this month');
            if ($end > $this->ahora()) continue;
            $ordinal = $endYear * 12 + $month;
            $rows[$ordinal] = ['trimestre' => "$season $year", 'etiqueta' => $labels[$season] . " $year", 'ano' => (int) $year,
                'valor' => (float) $anomaly, 'indice' => count($parts) === 3 ? 'RONI' : 'ONI',
                'fin_periodo' => $end->format('Y-m-d'), 'mes_ordinal' => $ordinal];
        }
        ksort($rows);
        return array_values($rows);
    }
}
