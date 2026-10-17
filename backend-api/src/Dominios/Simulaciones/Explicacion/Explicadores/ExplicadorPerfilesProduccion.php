<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorPerfilesProduccion.php — Puerto verbatim de SimulacionController::explain() línea 712 (perfiles financieros de producción).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorPerfilesProduccion implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué son los Perfiles Financieros?", 'tipo' => 'info',
             'contenido' => "Este comparador muestra cómo cambian tus ingresos, costos y ganancia según diferentes niveles de inversión (artesanal, tecnificado, intensivo) para tu parcela $nombreParcela de $areaHa ha."],
            ['titulo' => "2. ¿Cuál perfil te conviene más?", 'tipo' => 'success',
             'contenido' => !empty($impactoBase) ? $impactoBase : "El perfil que maximiza tu ganancia neta sin requerir inversión excesiva es el más recomendable. Compara el margen de cada perfil para decidir."],
            ['titulo' => "3. ¿Cómo pasar al siguiente perfil?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Para subir de perfil productivo, incrementa gradualmente la inversión en fertilizante y riego, y monitorea si el rendimiento adicional justifica el costo extra."]
        ];

        return $secciones;
    }
}
