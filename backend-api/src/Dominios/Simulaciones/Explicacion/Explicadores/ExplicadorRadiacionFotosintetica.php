<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorRadiacionFotosintetica.php — Puerto verbatim de SimulacionController::explain() línea 445 (radiación fotosintética).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorRadiacionFotosintetica implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué es la Radiación Fotosintética de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "El valor de **$valorConUnidad** mide la energía solar que las hojas de tu maíz capturan para convertirla en azúcares y almidón. El maíz es una planta C4 que necesita mucha luz solar para producir grano pesado."],
            ['titulo' => "2. ¿Tu cultivo está recibiendo suficiente luz?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Con **$valorConUnidad**, tu canopia tiene buena captura de luz. El rango ideal está entre " . (!empty($rangoIdeal) ? $rangoIdeal : "380 y 450 cal/cm²") . "."],
            ['titulo' => "3. ¿Cómo mejorar la captura de luz?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Mantén una densidad de siembra de 65,000 a 70,000 plantas/ha para que las hojas cubran el suelo uniformemente y capturen toda la luz disponible."]
        ];

        return $secciones;
    }
}
