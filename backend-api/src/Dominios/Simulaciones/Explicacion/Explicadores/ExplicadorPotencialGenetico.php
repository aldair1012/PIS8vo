<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorPotencialGenetico.php — Puerto verbatim de SimulacionController::explain() línea 434 (rendimiento potencial / genético).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorPotencialGenetico implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué significa el Rendimiento Potencial de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "El valor de **$valorConUnidad** es el máximo que la semilla de tu variedad $variedadMaiz puede producir bajo condiciones perfectas de laboratorio: sin plagas, con agua y nutrientes ilimitados. Es un techo teórico, no una meta de campo."],
            ['titulo' => "2. ¿Qué tan lejos estás de ese techo?", 'tipo' => $rendPredichoVal > ($potencialMax * 0.7) ? 'success' : 'warning',
             'contenido' => "Tu simulación estima una cosecha de **$rendPredichoVal t/ha**, lo que significa que estás aprovechando el **" . round(($rendPredichoVal / max(0.1, floatval(str_replace([' t/ha', ' '], '', $valor)))) * 100, 0) . "%** del potencial genético de la semilla."],
            ['titulo' => "3. ¿Cómo acercarte más al potencial?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Para cerrar la brecha entre $rendPredichoVal t/ha y $valorConUnidad, enfócate en corregir tu factor limitante principal: **$principalNombre** ($principalDetalle)."]
        ];

        return $secciones;
    }
}
