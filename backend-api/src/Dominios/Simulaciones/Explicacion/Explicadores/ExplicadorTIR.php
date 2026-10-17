<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorTIR.php — Puerto verbatim de SimulacionController::explain() línea 723 (TIR / tasa interna de retorno).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorTIR implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué es la TIR de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "La Tasa Interna de Retorno de **$valorConUnidad** mide la rentabilidad anualizada de tu cultivo. Si es mayor que la tasa de interés bancario (aproximadamente 8-10%), tu dinero rinde más en el maíz que en el banco."],
            ['titulo' => "2. ¿Tu cultivo es mejor inversión que el banco?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => $nivelText === 'favorable' ? "Sí. Con una TIR de $valorConUnidad, tu inversión en maíz supera las alternativas financieras convencionales." : "Tu TIR es baja. Evalúa si el esfuerzo y riesgo de sembrar justifican la ganancia comparada con otras opciones."],
            ['titulo' => "3. ¿Cómo mejorar la TIR?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta el rendimiento por hectárea y reduce costos innecesarios. Cada tonelada adicional que coseches mejora significativamente la TIR."]
        ];

        return $secciones;
    }
}
