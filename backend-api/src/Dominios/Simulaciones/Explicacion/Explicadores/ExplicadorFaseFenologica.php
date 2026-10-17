<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorFaseFenologica.php — Puerto verbatim de SimulacionController::explain() línea 582 (fase fenológica vulnerable).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorFaseFenologica implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué sucede en la etapa \"$nombre\"?", 'tipo' => 'info',
             'contenido' => !empty($descripcionTecnica) ? $descripcionTecnica : "En esta fase del ciclo del maíz, la planta es especialmente sensible a cambios bruscos de temperatura y disponibilidad de agua."],
            ['titulo' => "2. ¿Cuál es el riesgo principal en esta fase?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Si las condiciones no son las adecuadas durante esta etapa, el daño al rendimiento es irreversible porque la planta no puede compensarlo después."],
            ['titulo' => "3. ¿Qué debes hacer ahora en campo?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Revisa la humedad del suelo y la presencia de plagas. Aplica los insumos que correspondan a esta etapa antes de que la planta avance al siguiente estadio."]
        ];

        return $secciones;
    }
}
