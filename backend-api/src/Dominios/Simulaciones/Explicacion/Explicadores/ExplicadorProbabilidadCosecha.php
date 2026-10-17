<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorProbabilidadCosecha.php — Puerto verbatim de SimulacionController::explain() línea 502 (probabilidad de cosecha).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorProbabilidadCosecha implements ExplicadorInterface
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

        $porciento = preg_replace('/[^0-9.]/', '', $valor);
        $secciones = [
            ['titulo' => "1. ¿Qué significa una Probabilidad de Cosecha del $valor?", 'tipo' => 'info',
             'contenido' => "Hay un **$valor** de certeza estadística de que tu cultivo $variedadMaiz alcanzará las **$rendPredichoVal t/ha** estimadas sin sufrir un colapso por sequía, plagas o heladas durante el ciclo."],
            ['titulo' => "2. ¿Es buena esta probabilidad?", 'tipo' => floatval($porciento) >= 80 ? 'success' : 'warning',
             'contenido' => floatval($porciento) >= 80
                ? "Sí. Una confianza por encima del 80% indica que las condiciones de $ubicacion son estables y tu plan de manejo es sólido."
                : "Es baja. Factores como lluvias irregulares o temperaturas extremas en $ubicacion aumentan la incertidumbre. Se recomienda un plan de contingencia."],
            ['titulo' => "3. ¿Cómo mantener alta esta probabilidad?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Mantén el monitoreo de plagas, asegura riegos oportunos y evita sembrar fuera de la ventana óptima para $ubicacion."]
        ];

        return $secciones;
    }
}
