<?php
// src/Dominios/Terreno/Aplicacion/ServicioClimaActual.php — Clima observado y pronóstico con caché corta.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Aplicacion;

use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaActualInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

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
        $clave = sprintf('clima_actual_v1_%.3f_%.3f', round($latitud, 3), round($longitud, 3));
        $cacheado = $this->cache->obtener($clave, self::TTL_SEGUNDOS);
        if (is_array($cacheado) && ($cacheado['disponible'] ?? false)) {
            $cacheado['desde_cache'] = true;
            return $cacheado;
        }

        try {
            $datos = $this->proveedor->obtenerClimaActual($latitud, $longitud, $altitud);
            $datos['desde_cache'] = false;
            if (($datos['disponible'] ?? false) === true) {
                $this->cache->guardar($clave, $datos);
            }
            return $datos;
        } catch (ServicioExternoException $e) {
            return [
                'disponible' => false,
                'fuente' => 'Open-Meteo Forecast',
                'consultado_en' => date('c'),
                'actual' => null,
                'pronostico_7d' => [],
                'error' => 'No se pudo consultar el clima actual en este momento.',
            ];
        }
    }
}
