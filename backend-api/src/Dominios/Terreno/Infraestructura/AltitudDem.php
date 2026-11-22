<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Aplicacion\ConsultaConRespaldo;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;

final class AltitudDem
{
    public function __construct(private CacheInterface $cache) {}

    public function obtener(float $lat, float $lon): array
    {
        $clave = sprintf('dem_glo90_%.5f_%.5f', $lat, $lon);
        $registro = (new ConsultaConRespaldo($this->cache))->obtener($clave, 2592000, 31536000, static function () use ($lat, $lon) {
            $ch = curl_init('https://api.open-meteo.com/v1/elevation?' . http_build_query(['latitude' => $lat, 'longitude' => $lon]));
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 4, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_FAILONERROR => true]);
            $json = json_decode((string) curl_exec($ch), true);
            curl_close($ch);
            $valor = $json['elevation'][0] ?? null;
            return is_numeric($valor) && $valor >= -500 && $valor <= 9000 ? ['valor' => (float) $valor] : [];
        });
        return [
            'valor' => $registro['datos']['valor'] ?? null, 'unidad' => 'm s. n. m.',
            'tipo' => 'estimado', 'fuente' => 'Copernicus DEM GLO-90 · Open-Meteo',
            'resolucion' => '90 m', 'url' => 'https://open-meteo.com/en/docs/elevation-api',
            'consultado_utc' => $registro['consultado_utc'], 'estado' => $registro['estado'],
        ];
    }
}
