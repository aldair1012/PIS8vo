<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorYieldGap.php — Puerto verbatim de SimulacionController::explain() línea 527 (yield gap / brecha).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorYieldGap implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánto rendimiento estás perdiendo?", 'tipo' => 'danger',
             'contenido' => "La brecha de **$valorConUnidad** es la diferencia entre lo que tu semilla puede producir ($potencialMax t/ha) y lo que realmente vas a cosechar ($rendPredichoVal t/ha). Son toneladas que se pierden por limitaciones del campo."],
            ['titulo' => "2. ¿Cuál es la causa principal de esta pérdida?", 'tipo' => 'warning',
             'contenido' => "El factor que más contribuye a la brecha es **$principalNombre**: $principalDetalle. Corregir solo este factor podría recuperar hasta **$principalPerdida t/ha**."],
            ['titulo' => "3. ¿Vale la pena invertir en cerrar esta brecha?", 'tipo' => 'success',
             'contenido' => "Sí. Recuperar $principalPerdida t/ha equivale a **+$perdidaDolaresHa USD por hectárea** adicionales en ingresos. En tus $areaHa ha, eso sería **+" . round($perdidaDolaresHa * $areaHa, 2) . " USD** más."]
        ];

        return $secciones;
    }
}
