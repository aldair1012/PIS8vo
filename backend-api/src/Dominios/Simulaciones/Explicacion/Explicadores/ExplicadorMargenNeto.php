<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorMargenNeto.php — Puerto verbatim de SimulacionController::explain() línea 607 (margen neto / ganancia).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorMargenNeto implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánto dinero te queda limpio?", 'tipo' => 'info',
             'contenido' => "El Margen Neto de **$valorConUnidad** es lo que te queda después de restar todos los costos (semilla, fertilizante, mano de obra, riego) del ingreso total por la venta del maíz en tu parcela $nombreParcela."],
            ['titulo' => "2. ¿Este margen cubre tu trabajo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
             'contenido' => $nivelText === 'favorable'
                ? "Sí. Con $rendPredichoVal t/ha de cosecha y tus costos actuales, la siembra está generando una utilidad que justifica la inversión de tiempo y recursos."
                : "Tu margen está ajustado. Con el rendimiento actual de $rendPredichoVal t/ha, cualquier gasto imprevisto o caída de precio podría dejarte sin ganancia."],
            ['titulo' => "3. ¿Cómo aumentar tu margen?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta tu rendimiento corrigiendo $principalNombre y vende al menos a $16.50 USD/qq para cubrir costos con holgura."]
        ];

        return $secciones;
    }
}
