<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorRendimientoPredicho.php — Puerto verbatim de SimulacionController::explain() línea 489 (rendimiento predicho).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorRendimientoPredicho implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánto maíz vas a cosechar?", 'tipo' => 'info',
             'contenido' => "La simulación estima que vas a cosechar **$valorConUnidad** en tu parcela $nombreParcela ($areaHa ha) con la variedad $variedadMaiz. " . ($rendPredichoVal > 6.0 ? "Este es un rendimiento competitivo para la zona de $ubicacion." : "Este rendimiento está por debajo del promedio de $ubicacion.")],
            ['titulo' => "2. ¿Qué variables determinaron este resultado?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => "El modelo consideró: temperatura de **$temperaturaVal °C**, lluvia de **$precipitacionVal mm**, fertilización de **$fertilizanteVal kg/ha** y pH de **$phSuelo**. Tu factor más débil es **$principalNombre** ($principalDetalle)."],
            ['titulo' => "3. ¿Cómo subir tu rendimiento?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Corrige primero $principalNombre ya que es lo que más te resta. Después optimiza los otros factores para ganar toneladas adicionales."],
            ['titulo' => "4. Valor económico de tu cosecha", 'tipo' => 'info',
             'contenido' => "Con $rendPredichoVal t/ha en $areaHa ha, tu producción total sería de **" . round($rendPredichoVal * $areaHa, 1) . " toneladas** (" . round($rendPredichoVal * $areaHa * 22, 0) . " quintales), con un ingreso bruto estimado de **" . round($rendPredichoVal * $areaHa * 22 * 16.50, 2) . " USD** a $16.50 USD/qq."]
        ];

        return $secciones;
    }
}
