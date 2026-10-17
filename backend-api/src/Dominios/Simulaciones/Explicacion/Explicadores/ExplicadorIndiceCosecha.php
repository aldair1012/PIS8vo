<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorIndiceCosecha.php — Puerto verbatim de SimulacionController::explain() línea 516 (índice de cosecha (HI)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorIndiceCosecha implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué es el Índice de Cosecha de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "El Índice de Cosecha (HI) de **$valorConUnidad** indica que el **" . round(floatval(str_replace([' HI', ' '], '', $valor)) * 100, 0) . "%** de toda la biomasa que produce tu planta se convierte en grano de maíz. El resto son tallos, hojas y raíces."],
            ['titulo' => "2. ¿Tu planta es eficiente convirtiendo biomasa en grano?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Un HI entre 0.45 y 0.52 es óptimo. Tu valor de $valorConUnidad " . (floatval(str_replace([' HI', ' '], '', $valor)) >= 0.45 ? "es bueno, la planta está convirtiendo biomasa eficientemente." : "está por debajo, la planta gasta más energía en tallos y hojas que en grano.")],
            ['titulo' => "3. ¿Cómo mejorar esta conversión?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Asegura suficiente nitrógeno durante el llenado de grano (etapa R3-R5) para que las hojas mantengan la fotosíntesis activa el mayor tiempo posible."]
        ];

        return $secciones;
    }
}
