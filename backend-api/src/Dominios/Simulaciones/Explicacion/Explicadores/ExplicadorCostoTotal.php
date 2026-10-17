<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorCostoTotal.php — Puerto verbatim de SimulacionController::explain() línea 631 (costo total / insumos).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorCostoTotal implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánto te cuesta producir tu maíz?", 'tipo' => 'info',
             'contenido' => "El Costo Total de **$valorConUnidad** incluye todo lo que gastas para producir maíz en $nombreParcela: semilla, fertilizante ($fertilizanteVal kg/ha), preparación del terreno, riego y mano de obra."],
            ['titulo' => "2. ¿Tus costos son razonables?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Para la zona de $ubicacion, un costo de producción aceptable está entre $500 y $700 USD/ha. " . ($nivelText === 'favorable' ? "Tus costos están dentro del rango." : "Revisa si hay rubros que puedas optimizar sin perder rendimiento.")],
            ['titulo' => "3. ¿Dónde puedes reducir costos?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Compra fertilizante al inicio de temporada cuando los precios son más bajos y fracciona la aplicación para reducir desperdicio por lixiviación."]
        ];

        return $secciones;
    }
}
