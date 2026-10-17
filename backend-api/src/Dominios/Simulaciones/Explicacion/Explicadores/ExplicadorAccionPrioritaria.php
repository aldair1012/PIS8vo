<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorAccionPrioritaria.php — Puerto verbatim de SimulacionController::explain() línea 571 (acción prioritaria / correctora).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorAccionPrioritaria implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuál es la acción más urgente en tu lote?", 'tipo' => 'warning',
             'contenido' => "La práctica de **$valor** es la que más impacto tendría en tu rendimiento ahora mismo. Aplicarla a tiempo puede marcar la diferencia entre una cosecha rentable y una que no cubre los costos."],
            ['titulo' => "2. ¿Cuánto rendimiento puedes recuperar?", 'tipo' => 'success',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Aplicar esta corrección a tiempo puede recuperar entre 1.0 y 2.0 t/ha adicionales, dependiendo de cuándo se ejecute en relación a la etapa fenológica del cultivo."],
            ['titulo' => "3. ¿Cuándo es la fecha límite?", 'tipo' => 'danger',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "La ventana de oportunidad se cierra cuando la planta pasa de la floración (R1). Después de ese momento, el impacto se reduce drásticamente."]
        ];

        return $secciones;
    }
}
