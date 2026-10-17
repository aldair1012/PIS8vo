<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorIngresoBruto.php — Puerto verbatim de SimulacionController::explain() línea 620 (ingreso bruto).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorIngresoBruto implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánto dinero genera tu cosecha?", 'tipo' => 'info',
             'contenido' => "El Ingreso Bruto de **$valorConUnidad** es el total que recibirías al vender toda tu cosecha de $rendPredichoVal t/ha a precio de mercado, sin descontar costos de producción."],
            ['titulo' => "2. ¿De dónde sale este cálculo?", 'tipo' => 'info',
             'contenido' => "Se calcula multiplicando tu cosecha estimada ($rendPredichoVal t/ha × $areaHa ha = " . round($rendPredichoVal * $areaHa, 1) . " toneladas) por el precio del quintal de maíz ($16.50 USD/qq, con 22 quintales por tonelada)."],
            ['titulo' => "3. ¿Cómo maximizar tu ingreso?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta el rendimiento por hectárea y vende en el momento del año cuando el precio del quintal esté más alto (usualmente entre mayo y julio)."]
        ];

        return $secciones;
    }
}
