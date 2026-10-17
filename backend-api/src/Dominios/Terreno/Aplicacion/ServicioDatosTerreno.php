<?php
// src/Dominios/Terreno/Aplicacion/ServicioDatosTerreno.php — Orquestación de clima/suelo con caché de archivos de 24 h.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Aplicacion;

use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface;
use ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

final class ServicioDatosTerreno
{
    public function __construct(
        private CacheInterface $cache,
        private ProveedorClimaInterface $clima,
        private ProveedorSueloInterface $suelo,
    ) {
    }

    /**
     * Puerto literal de ClimateController::consultarDatosApiPrecision() (líneas 28–230).
     * Misma estructura exacta (success, source, clima, suelo) y mismos valores de fallback.
     *
     * @return array<string, mixed>
     */
    public function obtener(float $latitud, float $longitud, ?float $altitud = null): array
    {
        $claveLat = round($latitud, 3);
        $claveLng = round($longitud, 3);
        $clave = "precision_data_{$claveLat}_{$claveLng}";

        $datosCache = $this->cache->obtener($clave);
        if ($datosCache !== null) {
            $datosCache['source'] .= ' (Caché local de la parcela)';
            return $datosCache;
        }

        // Estimar región e indicar temperatura adecuada
        $esSierra = false;
        $esAmazonia = false;
        if ($altitud !== null) {
            $esSierra = $altitud > 1000 || ($longitud > -79.0 && $longitud < -78.0);
            $esAmazonia = $longitud > -77.5;
        } else {
            $esSierra = ($longitud > -79.0 && $longitud < -78.0);
            $esAmazonia = $longitud > -77.5;
        }

        $tempDefecto = 24.5;
        $humDefecto = 76.0;
        $precipDefecto = 1100.0;
        $phDefecto = 6.2;

        if ($esSierra) {
            // Gradiente térmico: disminuye la temp con la altitud
            $tempDefecto = $altitud !== null ? max(7.0, min(18.0, 20.0 - ($altitud - 1000) * 0.0045)) : 14.5;
            $humDefecto = 72.0;
            $precipDefecto = 900.0;
            $phDefecto = 5.8;
        } elseif ($esAmazonia) {
            $tempDefecto = 24.0;
            $humDefecto = 85.0;
            $precipDefecto = 2600.0;
            $phDefecto = 5.5;
        }

        $datosClimaYSuelo = [
            'success' => false,
            'source' => 'Simulado/Por Defecto',
            'clima' => [
                'temperatura' => $tempDefecto,
                'humedad' => $humDefecto,
                'precipitacion' => $precipDefecto,
                'viento' => 12.0,
                'temperatura_suelo' => $tempDefecto - 1.2,
            ],
            'suelo' => [
                'ph' => $phDefecto,
                'materia_organica' => $esSierra ? 3.5 : ($esAmazonia ? 4.5 : 2.2),
                'clay' => $esSierra ? 25.0 : ($esAmazonia ? 35.0 : 30.0),
                'sand' => $esSierra ? 45.0 : ($esAmazonia ? 25.0 : 40.0),
                'silt' => $esSierra ? 30.0 : ($esAmazonia ? 40.0 : 30.0)
            ]
        ];

        // API de Open-Meteo — Promedio histórico de los últimos 30 días
        try {
            $bloqueClima = $this->clima->obtenerClima($latitud, $longitud, $altitud);
            foreach ($bloqueClima as $claveClima => $valorClima) {
                $datosClimaYSuelo['clima'][$claveClima] = $valorClima;
            }
            // Sin mínimas en la API: temperatura_suelo = temperatura - 1.5 (líneas 145–147 del original).
            if (!array_key_exists('temperatura_suelo', $bloqueClima)) {
                $datosClimaYSuelo['clima']['temperatura_suelo'] = $datosClimaYSuelo['clima']['temperatura'] - 1.5;
            }
            $datosClimaYSuelo['success'] = true;
            $datosClimaYSuelo['source']  = 'Open-Meteo Archive API (Promedio 30 dias)';
        } catch (ServicioExternoException) {
            // Fallback: se conservan los valores por defecto, exactamente como en el original.
        }

        // API de SoilGrids
        try {
            $bloqueSuelo = $this->suelo->obtenerSuelo($latitud, $longitud);
            foreach ($bloqueSuelo as $claveSuelo => $valorSuelo) {
                $datosClimaYSuelo['suelo'][$claveSuelo] = $valorSuelo;
            }
            $datosClimaYSuelo['success'] = true;
            if ($datosClimaYSuelo['source'] === 'Open-Meteo API') {
                $datosClimaYSuelo['source'] = 'Open-Meteo & SoilGrids APIs (Tiempo real)';
            } else {
                $datosClimaYSuelo['source'] = 'SoilGrids API (Tiempo real)';
            }
        } catch (ServicioExternoException) {
            // Fallback: se conservan los valores por defecto, exactamente como en el original.
        }

        if ($datosClimaYSuelo['success']) {
            $this->cache->guardar($clave, $datosClimaYSuelo);
        }

        return $datosClimaYSuelo;
    }
}
