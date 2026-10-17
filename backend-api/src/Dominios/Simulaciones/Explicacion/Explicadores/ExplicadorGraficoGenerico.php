<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorGraficoGenerico.php — Puerto verbatim de SimulacionController::explain() línea 890 (gráfico genérico).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorGraficoGenerico implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué muestra \"$nombre\"?", 'tipo' => 'info',
             'contenido' => !empty($descripcionTecnica) ? $descripcionTecnica : "Este gráfico visualiza los datos de tu simulación para la parcela $nombreParcela, permitiéndote identificar patrones y tendencias en tu cultivo."],
            ['titulo' => "2. ¿Qué debes observar?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Busca los valores extremos (muy altos o muy bajos) y las tendencias. Los puntos fuera del rango normal indican áreas de oportunidad o riesgo que debes atender."],
            ['titulo' => "3. ¿Cómo usar estos datos?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Usa esta información para ajustar tu plan de manejo y priorizar los factores que más impactan tu rendimiento y rentabilidad."]
        ];

        return $secciones;
    }
}
