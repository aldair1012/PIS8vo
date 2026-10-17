<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorLluviaPromedio.php — Puerto verbatim de SimulacionController::explain() línea 757 (probabilidad de lluvia baja (promedio)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorLluviaPromedio implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué tan probable es que llueva poco?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
             'contenido' => "Hay un **$valorConUnidad** de probabilidad de que la lluvia en $ubicacion esté por debajo del promedio histórico durante este ciclo de cultivo. " . ($nivelText === 'favorable' ? "Este porcentaje es bajo, lo cual es positivo." : "Este porcentaje es preocupante y requiere un plan de contingencia.")],
            ['titulo' => "2. ¿Qué le pasa a tu maíz si llueve poco?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Si la lluvia es insuficiente durante la floración (VT-R1), los estigmas del maíz se secan y no capturan el polen. El resultado son mazorcas con pocos granos y pérdida de hasta 2-3 t/ha."],
            ['titulo' => "3. ¿Cómo prepararte?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Instala un sistema de riego complementario o programa riegos de auxilio de 25-30 mm durante las etapas V8 y VT."]
        ];

        return $secciones;
    }
}
