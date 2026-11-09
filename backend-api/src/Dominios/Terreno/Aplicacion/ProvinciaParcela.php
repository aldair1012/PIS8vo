<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Aplicacion;

/** Ubicación administrativa de referencia; no certifica linderos. Sin red. */
final class ProvinciaParcela
{
    private static ?array $mapa = null;

    public static function resolver(array $parcela): array
    {
        self::$mapa ??= json_decode((string) file_get_contents(__DIR__.'/../../../../data/referencias/provincias-ecuador.json'), true, 512, JSON_THROW_ON_ERROR);
        $lat = $parcela['latitud'] ?? null;
        $lon = $parcela['longitud'] ?? null;
        if (is_numeric($lat) && is_numeric($lon) && is_finite((float)$lat) && is_finite((float)$lon)) {
            foreach (self::$mapa['features'] as $feature) {
                [$minX,$minY,$maxX,$maxY] = $feature['bbox'];
                if ($lon < $minX || $lon > $maxX || $lat < $minY || $lat > $maxY) continue;
                $geometry=$feature['geometry'];
                $polygons=$geometry['type']==='Polygon' ? [$geometry['coordinates']] : $geometry['coordinates'];
                foreach ($polygons as $polygon) {
                    if (!self::enAnillo((float)$lon,(float)$lat,$polygon[0])) continue;
                    foreach (array_slice($polygon,1) as $hole) if (self::enAnillo((float)$lon,(float)$lat,$hole)) continue 2;
                    $name=$feature['properties']['provincia'];
                    if ($name === 'Zona No Delimitada') return ['provincia'=>null,'fuente'=>'Zona administrativa no delimitada en la referencia'];
                    return ['provincia'=>$name,'fuente'=>'Coordenadas de la parcela · INEC/HDX vía geoBoundaries (2018)'];
                }
            }
        }
        $text=' '.self::normalizar((string)($parcela['ubicacion']??'')).' ';
        foreach (self::$mapa['features'] as $feature) {
            $name=$feature['properties']['provincia'];
            if ($name !== 'Zona No Delimitada' && str_contains($text,' '.self::normalizar($name).' ')) return ['provincia'=>$name,'fuente'=>'Provincia indicada en la ubicación registrada'];
        }
        return ['provincia'=>null,'fuente'=>'Ubicación sin provincia confirmada'];
    }

    private static function normalizar(string $value): string
    {
        $ascii=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',mb_strtolower($value,'UTF-8'));
        return trim((string)preg_replace('/[^a-z0-9]+/',' ',$ascii));
    }

    private static function enAnillo(float $x,float $y,array $points): bool
    {
        $inside=false; $j=count($points)-1;
        foreach ($points as $i=>$p) {
            [$xi,$yi]=$p; [$xj,$yj]=$points[$j];
            if (($yi>$y)!==($yj>$y) && $x<($xj-$xi)*($y-$yi)/($yj-$yi)+$xi) $inside=!$inside;
            $j=$i;
        }
        return $inside;
    }
}
