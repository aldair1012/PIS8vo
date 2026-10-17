<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorPerdidaAgua.php — Puerto verbatim de SimulacionController::explain() línea 538 (pérdida por agua / estrés hídrico).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorPerdidaAgua implements ExplicadorInterface
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
            ['titulo' => "1. ¿Por qué pierdes $valorConUnidad por falta de agua?", 'tipo' => 'danger',
             'contenido' => "Tu lote en $ubicacion recibe **$precipitacionVal mm/año** de lluvia, cuando el maíz necesita al menos 750 mm bien distribuidos. Esta diferencia causa que las mazorcas no llenen todos los granos."],
            ['titulo' => "2. ¿En qué momento del cultivo más afecta la sequía?", 'tipo' => 'warning',
             'contenido' => "La falta de agua es más dañina entre la etapa V8 (8 hojas) y R1 (polinización). Durante esos 15-20 días, si el suelo se seca, los estigmas (sedas) no logran capturar el polen y la mazorca queda vacía."],
            ['titulo' => "3. ¿Cómo evitar esta pérdida?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aplica 2 riegos de auxilio de 25-30 mm durante la emergencia de la espiga y el llenado de grano para recuperar hasta " . abs($lossWater) . " t/ha."]
        ];

        return $secciones;
    }
}
