<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorCurvaTemporal.php — Puerto verbatim de SimulacionController::explain() línea 367 (curva temporal de rendimiento (gráfico)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorCurvaTemporal implements ExplicadorInterface
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
        $dg = $contexto['datos_grafico'];

        $actual = $dg['proyeccion_actual'] ?? [];
        $mejor = $dg['mejor_ano'] ?? [];
        $finalIdx = count($dg['labels'] ?? []) - 1;
        $valAct = round($actual[$finalIdx] ?? $rendPredichoVal, 2);
        $valMejor = round($mejor[$finalIdx] ?? 9.8, 2);
        $diff = round($valMejor - $valAct, 2);

        $secciones = [
            ['titulo' => "1. Tu cosecha proyectada vs el mejor año histórico", 'tipo' => 'info',
             'contenido' => "La curva de rendimiento acumulado de tu variedad $variedadMaiz en $nombreParcela proyecta una cosecha final de **$valAct t/ha**. El mejor año registrado en $ubicacion alcanzó **$valMejor t/ha**, una diferencia de **$diff t/ha**."],
            ['titulo' => "2. ¿Qué explica esa diferencia de $diff t/ha?", 'tipo' => $valAct >= $valMejor ? 'success' : 'warning',
             'contenido' => $valAct >= $valMejor
                ? "Tu manejo actual con $fertilizanteVal kg/ha de fertilizante y $precipitacionVal mm de lluvia está generando condiciones iguales o mejores que el año récord."
                : "La combinación de $fertilizanteVal kg/ha de fertilizante y $precipitacionVal mm de lluvia no alcanza las condiciones del mejor año. El llenado de grano entre los días 60 y 90 es la etapa donde más se pierde."],
            ['titulo' => "3. ¿Cómo cerrar esa brecha?", 'tipo' => 'success',
             'contenido' => "Aplica la segunda dosis de Nitrógeno (60 kg/ha) 10 días antes de la floración (V8) y asegura humedad constante en el suelo durante la emisión de la espiga."]
        ];

        return $secciones;
    }
}
