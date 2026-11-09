<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

/** SoilGrids 2.0 por WMS: punto de malla, no análisis de laboratorio. */
final class ProveedorSoilGrids implements ProveedorSueloInterface
{
    public function obtenerSuelo(float $latitud, float $longitud): array
    {
        $multi=curl_multi_init(); $handles=[];
        foreach (['clay','sand','silt','phh2o','soc'] as $property) {
            $query=http_build_query([
                'map'=>"/map/{$property}.map", 'SERVICE'=>'WMS', 'VERSION'=>'1.1.1', 'REQUEST'=>'GetFeatureInfo',
                'LAYERS'=>"{$property}_0-5cm_mean", 'QUERY_LAYERS'=>"{$property}_0-5cm_mean",
                'SRS'=>'EPSG:4326', 'BBOX'=>implode(',',[$longitud-.001,$latitud-.001,$longitud+.001,$latitud+.001]),
                'WIDTH'=>3,'HEIGHT'=>3,'X'=>1,'Y'=>1,'STYLES'=>'','FORMAT'=>'image/png','INFO_FORMAT'=>'application/geo+json',
            ],'', '&',PHP_QUERY_RFC3986);
            $ch=curl_init('https://maps.isric.org/mapserv?'.$query);
            curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>5,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_USERAGENT=>'ZeaSys/2.4 (agricultural reference map)']);
            curl_multi_add_handle($multi,$ch); $handles[$property]=$ch;
        }
        do {
            $status=curl_multi_exec($multi,$running);
            if ($running && $status===CURLM_OK && curl_multi_select($multi,.2)===-1) usleep(10000);
        } while ($running && $status===CURLM_OK);
        $muestras=[];
        foreach ($handles as $property=>$ch) {
            if (curl_getinfo($ch,CURLINFO_HTTP_CODE)===200) {
                $json=json_decode((string)curl_multi_getcontent($ch),true);
                $muestras[$property]=$json['features'][0]['properties']['pixel_value'] ?? null;
            }
            curl_multi_remove_handle($multi,$ch); curl_close($ch);
        }
        curl_multi_close($multi);
        $result=self::interpretarMuestras($muestras);
        if ($result===[]) throw new ServicioExternoException('El mapa de suelo no devolvió datos para estas coordenadas.');
        return $result;
    }

    public static function interpretarMuestras(array $muestras): array
    {
        $result=[];
        foreach (['clay','sand','silt','phh2o','soc'] as $property) {
            $raw=$muestras[$property]??null;
            if (is_bool($raw) || !is_numeric($raw) || !is_finite((float)$raw) || $raw<0) continue;
            $raw=(float)$raw;
            if (in_array($property,['clay','sand','silt'],true) && $raw<=1000) $result[$property]=round($raw/10,1);
            if ($property==='phh2o' && $raw>0 && $raw<=140) $result['ph']=round($raw/10,1);
            if ($property==='soc' && $raw/100*1.724<=100) $result['materia_organica']=round($raw/100*1.724,2);
        }
        // Una respuesta incompleta no permite deducir el tipo de suelo.
        if (isset($result['clay'],$result['sand'],$result['silt']) && abs($result['clay']+$result['sand']+$result['silt']-100)>5) {
            unset($result['clay'],$result['sand'],$result['silt']);
        }
        return $result;
    }
}
