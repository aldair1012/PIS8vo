<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorSensibilidad.php — Puerto verbatim de SimulacionController::explain() línea 412 (sensibilidad financiera (gráfico)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorSensibilidad implements ExplicadorInterface
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

        $margenes = array_column($dg, 'margen');
        $maxMargen = !empty($margenes) ? round(max($margenes), 2) : 850;
        $minMargen = !empty($margenes) ? round(min($margenes), 2) : -120;

        $secciones = [
            ['titulo' => "1. ¿Cuánto puedes ganar o perder según el precio?", 'tipo' => 'info',
             'contenido' => "Si el precio del maíz sube y mantienes tu rendimiento de $rendPredichoVal t/ha, tu ganancia puede alcanzar **+$maxMargen USD/ha**. Si el precio baja al mínimo, tu margen se reduce a **$minMargen USD/ha**."],
            ['titulo' => "2. ¿Por qué varía tanto tu ganancia?", 'tipo' => 'warning',
             'contenido' => "Tu margen es sensible porque tus costos de producción incluyen $fertilizanteVal kg/ha de fertilizante. Si el precio del maíz cae por debajo de $14.50 USD/qq, tus costos pueden superar tus ingresos."],
            ['titulo' => "3. ¿Cómo protegerte de una caída de precios?", 'tipo' => 'success',
             'contenido' => "Pacta contratos de venta anticipada fijando un precio mínimo de $16.50 USD/qq y reduce costos variables optimizando la dosis de fertilizante sin sacrificar rendimiento."]
        ];

        return $secciones;
    }
}
