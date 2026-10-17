<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorSuperarObjetivo.php — Puerto verbatim de SimulacionController::explain() línea 824 (probabilidad de superar objetivo).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorSuperarObjetivo implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuántas chances tienes de lograr tu objetivo?", 'tipo' => 'info',
             'contenido' => "La probabilidad de **$valorConUnidad** indica las chances de que tu cosecha supere el objetivo mínimo necesario. " . (floatval(str_replace(['%', ' '], '', $valor)) >= 70 ? "Es una probabilidad favorable." : "Está por debajo de lo ideal y conviene tomar medidas para mejorarla.")],
            ['titulo' => "2. ¿Qué puede hacer que no lo logres?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Los factores que más pueden impedirlo son: sequías inesperadas, caída de precios o ataques de plagas durante la fase reproductiva del maíz."],
            ['titulo' => "3. ¿Cómo aumentar esta probabilidad?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Diversifica riesgos sembrando en distintas fechas y asegura la nutrición completa del cultivo para no depender solo del clima."]
        ];

        return $secciones;
    }
}
