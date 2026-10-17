<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorPuntoEquilibrio.php — Puerto verbatim de SimulacionController::explain() línea 653 (punto de equilibrio).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorPuntoEquilibrio implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánto necesitas cosechar como mínimo?", 'tipo' => 'info',
             'contenido' => "El Punto de Equilibrio de **$valorConUnidad** es el rendimiento mínimo que necesitas para cubrir todos tus costos de producción. Si cosechas menos que esto, pierdes dinero."],
            ['titulo' => "2. ¿Estás por encima del equilibrio?", 'tipo' => $rendPredichoVal > floatval(str_replace([' t/ha', ' '], '', $valor)) ? 'success' : 'danger',
             'contenido' => $rendPredichoVal > floatval(str_replace([' t/ha', ' '], '', $valor))
                ? "Sí. Tu rendimiento estimado de **$rendPredichoVal t/ha** supera el punto de equilibrio, lo que indica que generarás ganancia neta."
                : "No. Tu rendimiento estimado de **$rendPredichoVal t/ha** está por debajo o muy cerca del equilibrio. Necesitas subir la producción o reducir costos para no tener pérdidas."],
            ['titulo' => "3. ¿Cómo asegurar que siempre estés por encima?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Reduce el punto de equilibrio bajando costos fijos y variables, y simultáneamente sube el rendimiento corrigiendo $principalNombre."]
        ];

        return $secciones;
    }
}
