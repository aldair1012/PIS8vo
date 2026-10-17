<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorComparadorHibridos.php — Puerto verbatim de SimulacionController::explain() línea 868 (comparador de híbridos).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorComparadorHibridos implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué muestra este comparador?", 'tipo' => 'info',
             'contenido' => "Compara cómo rinden diferentes combinaciones de fecha de siembra e híbridos de maíz para tu zona de $ubicacion. Te ayuda a elegir la mejor combinación para maximizar la cosecha."],
            ['titulo' => "2. ¿Cómo interpretar los resultados?", 'tipo' => 'success',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Las celdas de color verde indican combinaciones con alto rendimiento. Las celdas rojas o amarillas indican combinaciones de menor productividad para las condiciones de tu zona."],
            ['titulo' => "3. ¿Qué combinación elegir?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Elige la combinación con el mayor rendimiento estimado y verifica que el híbrido esté disponible en tu zona. Prioriza las celdas verdes con ventana de siembra de enero a marzo."]
        ];

        return $secciones;
    }
}
