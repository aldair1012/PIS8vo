<?php
// src/Dominios/Terreno/Infraestructura/ProveedorSoilGrids.php — SoilGrids v2.0: propiedades del suelo 0-5cm (cURL verbatim).
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

final class ProveedorSoilGrids implements ProveedorSueloInterface
{
    public function obtenerSuelo(float $latitud, float $longitud): array
    {
        $urlSuelo = "https://rest.isric.org/soilgrids/v2.0/properties/query?lon={$longitud}&lat={$latitud}&property=phh2o&property=clay&property=sand&property=silt&property=soc&depth=0-5cm&value=mean";
        $ch = curl_init($urlSuelo);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 3,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_USERAGENT      => 'AgroPredict/2.0'
        ]);
        $respuestaSuelo = curl_exec($ch);
        curl_close($ch);

        if (!$respuestaSuelo) {
            throw new ServicioExternoException('SoilGrids API sin respuesta.');
        }

        $jsonSuelo = json_decode($respuestaSuelo, true);
        if (!$jsonSuelo || !isset($jsonSuelo['properties']['layers']) || !is_array($jsonSuelo['properties']['layers'])) {
            throw new ServicioExternoException('SoilGrids API con respuesta inválida.');
        }

        $capasSuelo = $jsonSuelo['properties']['layers'];
        $datosSueloTemp = [];
        foreach ($capasSuelo as $capa) {
            if (!is_array($capa)) {
                continue;
            }
            $nombreCapa = $capa['name'] ?? null;
            if (is_string($nombreCapa) && isset($capa['depths'][0]['values']['mean'])) {
                $datosSueloTemp[$nombreCapa] = floatval($capa['depths'][0]['values']['mean']);
            }
        }

        $actualizaciones = [];

        if (isset($datosSueloTemp['phh2o'])) {
            $actualizaciones['ph'] = round($datosSueloTemp['phh2o'] / 10.0, 1);
        }
        if (isset($datosSueloTemp['clay'])) {
            $actualizaciones['clay'] = round($datosSueloTemp['clay'] / 10.0, 1);
        }
        if (isset($datosSueloTemp['sand'])) {
            $actualizaciones['sand'] = round($datosSueloTemp['sand'] / 10.0, 1);
        }
        if (isset($datosSueloTemp['silt'])) {
            $actualizaciones['silt'] = round($datosSueloTemp['silt'] / 10.0, 1);
        }
        if (isset($datosSueloTemp['soc'])) {
            $soc_pct = $datosSueloTemp['soc'] / 100.0;
            $actualizaciones['materia_organica'] = round($soc_pct * 1.724, 2);
        }

        return $actualizaciones;
    }
}
