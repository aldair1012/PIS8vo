<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorDistribucionProbabilistica.php — Puerto verbatim de SimulacionController::explain() línea 387 (distribución probabilística gauss/montecarlo (gráfico)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorDistribucionProbabilistica implements ExplicadorInterface
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
        $dg = $contexto['datos_grafico'];

        $rawP50 = isset($dg['p50']) && floatval($dg['p50']) > 0 ? floatval($dg['p50']) : $rendPredichoVal;
        $rawP10 = isset($dg['p10']) && floatval($dg['p10']) > 0 ? floatval($dg['p10']) : ($rawP50 * 0.72);
        $rawP90 = isset($dg['p90']) && floatval($dg['p90']) > 0 ? floatval($dg['p90']) : ($rawP50 * 1.28);

        if (abs($rawP90 - $rawP10) < 0.3) {
            $rawP10 = max(2.1, round($rawP50 * 0.72, 2));
            $rawP90 = round($rawP50 * 1.28, 2);
        }

        $p10 = round($rawP10, 2);
        $p50 = round($rawP50, 2);
        $p90 = round($rawP90, 2);
        $rango = round($p90 - $p10, 2);

        $secciones = [
            ['titulo' => "1. Los 3 escenarios de cosecha posibles", 'tipo' => 'info',
             'contenido' => "Tu cosecha más probable es **$p50 t/ha**. En un año con clima favorable podrías alcanzar hasta **$p90 t/ha**, pero si hay sequía o lluvias excesivas en $ubicacion, la cosecha podría caer a **$p10 t/ha**."],
            ['titulo' => "2. ¿Qué tan amplio es el riesgo?", 'tipo' => 'warning',
             'contenido' => "La diferencia entre el mejor y peor escenario es de **$rango t/ha**. Cuanto más grande sea este rango, más depende tu cosecha de factores climáticos que no puedes controlar."],
            ['titulo' => "3. ¿Cómo reducir la incertidumbre?", 'tipo' => 'success',
             'contenido' => "Para elevar el piso pesimista de $p10 t/ha, incorpora materia orgánica al suelo $tipoSuelo para retener más agua y considera semillas tolerantes a sequía para la próxima campaña."]
        ];

        return $secciones;
    }
}
