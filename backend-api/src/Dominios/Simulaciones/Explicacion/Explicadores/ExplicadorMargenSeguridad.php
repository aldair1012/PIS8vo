<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorMargenSeguridad.php — Puerto verbatim de SimulacionController::explain() línea 679 (margen de seguridad).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorMargenSeguridad implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué es el Margen de Seguridad de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "El Margen de Seguridad indica cuántas toneladas por hectárea tienes de colchón entre tu rendimiento estimado ($rendPredichoVal t/ha) y el punto de equilibrio. Un margen de **$valorConUnidad** significa que puedes absorber esa pérdida sin entrar en números rojos."],
            ['titulo' => "2. ¿Es suficiente para absorber imprevistos?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => $nivelText === 'favorable' ? "Sí, tienes un colchón razonable para enfrentar variaciones climáticas o de precio." : "Tu colchón es delgado. Cualquier baja de precio o caída de cosecha por clima podría hacerte perder dinero."],
            ['titulo' => "3. ¿Cómo ampliar tu margen de seguridad?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta tu rendimiento y baja costos para tener un colchón más amplio entre tu producción y el equilibrio."]
        ];

        return $secciones;
    }
}
