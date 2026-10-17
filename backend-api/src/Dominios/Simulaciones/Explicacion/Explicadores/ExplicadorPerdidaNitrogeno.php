<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorPerdidaNitrogeno.php — Puerto verbatim de SimulacionController::explain() línea 549 (pérdida por nitrógeno).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorPerdidaNitrogeno implements ExplicadorInterface
{
    public function construir(array $contexto): array
    {
        $nombreParcela = $contexto['nombre_parcela'];
        $variedadMaiz = $contexto['variedad_maiz'];
        $ubicacion = $contexto['ubicacion'];
        $areaHa = $contexto['area_ha'];
        $phSuelo = $contexto['ph_suelo'];
        $fertilizanteVal = $contexto['fertilizante'];
        $temperaturaVal = $contexto['temperatura'];
        $precipitacionVal = $contexto['precipitacion'];
        $humedadVal = $contexto['humedad'];
        $tipoSuelo = $contexto['tipo_suelo'];
        $rendPredichoVal = $contexto['rend_predicho'];
        $nombre = $contexto['nombre'];
        $valor = $contexto['valor'];
        $unidad = $contexto['unidad'];
        $estado = $contexto['estado'];
        $rangoIdeal = $contexto['rango_ideal'];
        $descripcionTecnica = $contexto['descripcion_tecnica'];
        $impactoBase = $contexto['impacto_base'];
        $recomendacionBase = $contexto['recomendacion_base'];
        $valorConUnidad = $contexto['valor_con_unidad'];
        $nivelText = $contexto['nivel_text'];
        $potencialMax = $contexto['potencial_max'];
        $lossN = $contexto['loss_n'];
        $lossWater = $contexto['loss_water'];
        $lossPh = $contexto['loss_ph'];
        $lossTemp = $contexto['loss_temp'];
        $principalNombre = $contexto['principal_nombre'];
        $principalPerdida = $contexto['principal_perdida'];
        $principalDetalle = $contexto['principal_detalle'];
        $perdidaDolaresHa = $contexto['perdida_dolares_ha'];
        $nombreLower = $contexto['nombre_lower'];

        $secciones = [
            ['titulo' => "1. ¿Por qué pierdes $valorConUnidad por falta de Nitrógeno?", 'tipo' => 'danger',
             'contenido' => "Estás aplicando **$fertilizanteVal kg/ha** de Nitrógeno cuando tu variedad $variedadMaiz necesita al menos **180 kg/ha** para alcanzar su potencial. Esos " . round(180 - $fertilizanteVal, 0) . " kg/ha que faltan se traducen directamente en granos más pequeños y mazorcas incompletas."],
            ['titulo' => "2. ¿En qué se nota la falta de Nitrógeno?", 'tipo' => 'warning',
             'contenido' => "Las hojas inferiores se ponen amarillas formando una 'V' desde la punta. Las plantas crecen más bajas y las mazorcas pesan menos porque no tienen suficiente nutriente para llenar todos los granos."],
            ['titulo' => "3. ¿Cómo corregir el déficit?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Sube la dosis total a 180 kg/ha dividida en 3 aplicaciones: 60 kg/ha en siembra, 60 kg/ha en V4 (aporque) y 60 kg/ha en V8 (pre-floración)."]
        ];

        return $secciones;
    }
}
