<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorBeneficioCosto.php — Puerto verbatim de SimulacionController::explain() línea 642 (beneficio/costo (B/C)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorBeneficioCosto implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué significa una Relación B/C de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "Una relación Beneficio/Costo de **$valorConUnidad** indica que por cada dólar invertido en tu cultivo, generas **$valor** dólares en retorno. " . (floatval(str_replace([' ', '$'], '', $valor)) > 1.0 ? "Como es mayor a 1.0, tu proyecto es rentable." : "Si es menor a 1.0, estás perdiendo dinero.")],
            ['titulo' => "2. ¿Es competitivo para la zona?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "En la agricultura de $ubicacion, una relación B/C mayor a 1.3 se considera buena y mayor a 1.5 es excelente."],
            ['titulo' => "3. ¿Cómo mejorar la relación B/C?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Sube el rendimiento corrigiendo tu limitante principal ($principalNombre) y negocia precios de venta anticipados para asegurar ingresos."]
        ];

        return $secciones;
    }
}
