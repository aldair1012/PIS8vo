<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorAguaPorEstrato.php — Puerto verbatim de SimulacionController::explain() línea 801 (agua por estrato de suelo).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorAguaPorEstrato implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué muestra el agua por capas del suelo?", 'tipo' => 'info',
             'contenido' => "Este análisis divide tu suelo en capas (0-20 cm, 20-40 cm, 40-100 cm) y mide cuánta agua tiene cada una. Las raíces del maíz joven usan las capas superficiales, mientras que las raíces profundas acceden a las capas más bajas durante la sequía."],
            ['titulo' => "2. ¿Por qué importa la distribución por capas?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Si las capas superficiales (0-40 cm) se secan, tu maíz dependerá de las reservas profundas (40-100 cm). Si esas también están vacías, la planta entra en estrés severo."],
            ['titulo' => "3. ¿Cómo mantener agua en todas las capas?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Incorpora materia orgánica y rastrojos en el suelo para mejorar la infiltración y retención hídrica en todas las profundidades."]
        ];

        return $secciones;
    }
}
