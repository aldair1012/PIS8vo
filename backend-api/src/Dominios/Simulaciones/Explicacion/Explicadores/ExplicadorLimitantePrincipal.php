<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorLimitantePrincipal.php — Puerto verbatim de SimulacionController::explain() línea 560 (limitante principal).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorLimitantePrincipal implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuál es el principal cuello de botella?", 'tipo' => 'danger',
             'contenido' => "El factor que más está limitando tu rendimiento en $nombreParcela es **$principalNombre**: $principalDetalle. Te resta **-$principalPerdida t/ha**."],
            ['titulo' => "2. ¿Por qué este factor es el más importante?", 'tipo' => 'warning',
             'contenido' => "Mientras no corrijas $principalNombre, invertir en otros insumos tendrá muy poco impacto. Es como regar una planta que necesita sol: el agua sobra si falta lo esencial."],
            ['titulo' => "3. ¿Cuánto dinero recuperas al corregirlo?", 'tipo' => 'success',
             'contenido' => "Corregir $principalNombre puede recuperar hasta **$principalPerdida t/ha**, equivalente a **+$perdidaDolaresHa USD/ha** adicionales (+" . round($perdidaDolaresHa * $areaHa, 2) . " USD en tus $areaHa ha)."]
        ];

        return $secciones;
    }
}
