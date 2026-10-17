<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorROI.php — Puerto verbatim de SimulacionController::explain() línea 594 (ROI / retorno de inversión).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorROI implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué significa un ROI de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "Un Retorno de Inversión de **$valorConUnidad** significa que por cada dólar que inviertes en tu lote $nombreParcela, recuperas ese dólar más **" . round(floatval(str_replace(['%', ' '], '', $valor)) / 100, 2) . " USD** de ganancia. " . (floatval(str_replace(['%', ' '], '', $valor)) > 20 ? "Es una rentabilidad atractiva." : "Es un retorno que podría mejorar.")],
            ['titulo' => "2. ¿Tu inversión en maíz es rentable?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => $nivelText === 'favorable'
                ? "Sí. Con un rendimiento de $rendPredichoVal t/ha y el precio actual del maíz, tu inversión genera más ganancia que dejar el dinero en el banco."
                : "Con el rendimiento actual de $rendPredichoVal t/ha, tu ROI está bajo. Necesitas subir la cosecha o reducir costos para que la siembra sea más rentable."],
            ['titulo' => "3. ¿Cómo mejorar la rentabilidad?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Reduce costos fraccionando la compra de insumos y negocia el precio de venta anticipadamente para asegurar un ingreso mínimo."]
        ];

        return $secciones;
    }
}
