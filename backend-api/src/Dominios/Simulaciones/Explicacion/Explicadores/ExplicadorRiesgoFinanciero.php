<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorRiesgoFinanciero.php — Puerto verbatim de SimulacionController::explain() línea 701 (riesgo financiero / agronómico).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorRiesgoFinanciero implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué tan alto es tu riesgo con $valorConUnidad?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
             'contenido' => "Un nivel de riesgo de **$valorConUnidad** " . ($nivelText === 'favorable' ? "es bajo, lo que indica que las condiciones actuales son estables para tu cultivo en $ubicacion." : "es preocupante. Indica que hay una probabilidad significativa de que tu cosecha no cubra la inversión en $nombreParcela.")],
            ['titulo' => "2. ¿Qué factores elevan tu riesgo?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Los factores que más influyen en el riesgo son: variabilidad de lluvias ($precipitacionVal mm), temperatura ($temperaturaVal °C) y el precio de venta del quintal de maíz."],
            ['titulo' => "3. ¿Cómo reducir el riesgo?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Diversifica con diferentes fechas de siembra, asegura contratos de precio fijo y mantén un fondo de contingencia para imprevistos."]
        ];

        return $secciones;
    }
}
