<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorAguaUtil.php — Puerto verbatim de SimulacionController::explain() línea 478 (agua útil / balance hídrico).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorAguaUtil implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánta agua necesita tu cultivo?", 'tipo' => 'info',
             'contenido' => "Tu maíz variedad $variedadMaiz necesita **$valorConUnidad** de agua durante todo su ciclo de 120 días. " . (!empty($rangoIdeal) ? "El rango adecuado es $rangoIdeal." : "Lo ideal son entre 450 y 550 mm.")],
            ['titulo' => "2. ¿Tu zona cubre esa necesidad?", 'tipo' => $precipitacionVal >= 600 ? 'success' : 'danger',
             'contenido' => "En $ubicacion se registran **$precipitacionVal mm/año** de lluvia. " . ($precipitacionVal >= 600 ? "Esto cubre la mayor parte de la demanda hídrica del cultivo." : "Esto está por debajo de lo necesario, lo que puede causar estrés hídrico durante la floración.")],
            ['titulo' => "3. ¿Qué hacer si falta agua?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Programa riegos de auxilio de 25-30 mm en la etapa V8 a VT (floración) que es cuando la planta más agua consume."]
        ];

        return $secciones;
    }
}
