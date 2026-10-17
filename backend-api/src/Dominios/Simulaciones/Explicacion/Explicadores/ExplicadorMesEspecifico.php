<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorMesEspecifico.php — Puerto verbatim de SimulacionController::explain() línea 857 (mes específico).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorMesEspecifico implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué dice el análisis de $nombre?", 'tipo' => 'info',
             'contenido' => "Este mes " . (strpos($nombreLower, 'recomendado') !== false ? "**sí es recomendado** para sembrar." : "**no es recomendado** para la siembra.") . " La evaluación considera la lluvia esperada, temperatura promedio y riesgo de eventos extremos para $ubicacion."],
            ['titulo' => "2. ¿Cuáles son las condiciones esperadas?", 'tipo' => strpos($nombreLower, 'recomendado') !== false ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : (strpos($nombreLower, 'recomendado') !== false ? "Las condiciones de lluvia y temperatura son favorables para el establecimiento del cultivo y su posterior floración." : "Las condiciones de este mes podrían exponer la floración a estrés hídrico o térmico, reduciendo el potencial de cosecha.")],
            ['titulo' => "3. Recomendación", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Compara este mes con las alternativas disponibles en el calendario y elige la ventana que mejor proteja la etapa de floración."]
        ];

        return $secciones;
    }
}
