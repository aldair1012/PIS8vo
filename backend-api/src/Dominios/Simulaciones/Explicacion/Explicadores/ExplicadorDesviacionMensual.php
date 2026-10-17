<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorDesviacionMensual.php — Puerto verbatim de SimulacionController::explain() línea 790 (desviación mensual (gráfico clima)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorDesviacionMensual implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué muestra la Desviación Mensual?", 'tipo' => 'info',
             'contenido' => "Este gráfico compara la lluvia y temperatura de cada mes contra el promedio histórico de $ubicacion. Las barras que se salen del rango normal indican meses atípicos que pueden afectar tu cultivo."],
            ['titulo' => "2. ¿Hay meses preocupantes?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Los meses con desviaciones grandes durante la floración (VT-R1) son los más riesgosos. Una sequía de 15 días en ese periodo puede costar hasta 2 t/ha de rendimiento."],
            ['titulo' => "3. ¿Cómo usar esta información?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Planifica tu fecha de siembra para que la floración no coincida con los meses de mayor riesgo climático identificados en este gráfico."]
        ];

        return $secciones;
    }
}
