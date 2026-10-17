<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorGananciaPorDolar.php — Puerto verbatim de SimulacionController::explain() línea 734 (ganancia por dólar).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorGananciaPorDolar implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánto ganas por cada dólar invertido?", 'tipo' => 'info',
             'contenido' => "Por cada dólar que inviertes en tu cultivo de maíz en $nombreParcela, obtienes **$valorConUnidad** de retorno. " . (floatval(str_replace(['$', 'USD', ' '], '', $valor)) > 0 ? "Esto incluye tu capital original más la ganancia." : "Este valor indica que no estás recuperando tu inversión.")],
            ['titulo' => "2. ¿Es competitivo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Una ganancia por dólar superior a $0.20 USD se considera buena en agricultura de maíz para la zona de $ubicacion."],
            ['titulo' => "3. ¿Cómo mejorar este retorno?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Negocia mejores precios de compra de insumos y optimiza la dosis de fertilizante para obtener más kilos de grano por kg de Nitrógeno aplicado."]
        ];

        return $secciones;
    }
}
