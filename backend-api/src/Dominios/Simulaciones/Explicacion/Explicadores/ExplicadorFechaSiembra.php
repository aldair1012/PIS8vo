<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorFechaSiembra.php — Puerto verbatim de SimulacionController::explain() línea 846 (fecha de siembra).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorFechaSiembra implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuándo es el mejor momento para sembrar?", 'tipo' => 'info',
             'contenido' => "La fecha de siembra recomendada es **$valor**. Esta ventana se calcula cruzando los patrones históricos de lluvia y temperatura de $ubicacion con las necesidades fisiológicas de la variedad $variedadMaiz."],
            ['titulo' => "2. ¿Qué pasa si siembras fuera de la ventana?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Sembrar muy temprano o muy tarde puede hacer que la floración coincida con días de calor extremo o sequía, reduciendo tu cosecha entre 1.5 y 3.0 t/ha."],
            ['titulo' => "3. ¿Cómo ajustar la fecha según tu zona?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Consulta el calendario agroclimático del INAMHI para tu provincia y confirma que el suelo tenga buena humedad antes de colocar la semilla."]
        ];

        return $secciones;
    }
}
