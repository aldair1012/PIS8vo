<?php
// src/Dominios/Terreno/Aplicacion/ServicioClimaActual.php — Clima observado y pronóstico con caché corta.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Aplicacion;

use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaActualInterface;

final class ServicioClimaActual
{
    private const TTL_SEGUNDOS = 1800; // 30 minutos: suficiente para no golpear la API en cada mensaje.

    public function __construct(
        private CacheInterface $cache,
        private ProveedorClimaActualInterface $proveedor,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtener(float $latitud, float $longitud, ?float $altitud = null): array
    {
        $clave = sprintf('pronostico_v2_%.4f_%.4f_%s', $latitud, $longitud, $altitud ?? 'auto');
        $registro = (new ConsultaConRespaldo($this->cache))->obtener($clave, self::TTL_SEGUNDOS, 2 * 86400, function () use ($latitud, $longitud, $altitud) {
            $datos = $this->proveedor->obtenerClimaActual($latitud, $longitud, $altitud);
            return ($datos['disponible'] ?? false) ? $datos : [];
        });
        if (!$registro['datos']) {
            return ['disponible' => false, 'fuente' => 'Open-Meteo Forecast', 'consultado_en' => null,
                'actual' => null, 'pronostico_7d' => [], 'estado' => 'sin_datos',
                'error' => 'No se pudo consultar el clima. Vuelve a intentarlo en cinco minutos.'];
        }
        return $registro['datos'] + ['estado' => $registro['estado'], 'desde_cache' => $registro['estado'] !== 'actualizado',
            'consultado_utc' => $registro['consultado_utc'], 'resolucion' => 'Variable según modelo de pronóstico'];
    }
}
