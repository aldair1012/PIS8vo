<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorDefault.php — Puerto verbatim de SimulacionController::explain() línea 901 (tarjeta no reconocida (fallback final)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorDefault implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué indica \"$nombre\" con valor de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => !empty($descripcionTecnica) ? "En tu parcela $nombreParcela: $descripcionTecnica" : "El indicador **$nombre** registra un valor de **$valorConUnidad** para tu parcela $nombreParcela ($areaHa ha) con la variedad $variedadMaiz en $ubicacion." . (!empty($rangoIdeal) ? " El rango ideal para esta métrica es de $rangoIdeal." : "")],
            ['titulo' => "2. ¿Cómo afecta a tu cultivo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : ($nivelText === 'favorable' ? "El valor de **$valorConUnidad** para $nombre es adecuado para las condiciones de $ubicacion y tu variedad $variedadMaiz." : "El valor de **$valorConUnidad** para $nombre podría estar afectando tu rendimiento estimado de $rendPredichoVal t/ha. Tu factor limitante principal es $principalNombre.")],
            ['titulo' => "3. Recomendación para tu lote", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Revisa si puedes optimizar $nombre ajustando los insumos o el manejo agronómico de tu parcela $nombreParcela."]
        ];

        return $secciones;
    }
}
