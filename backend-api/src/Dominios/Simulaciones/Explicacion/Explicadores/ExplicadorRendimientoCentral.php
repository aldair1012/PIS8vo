<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorRendimientoCentral.php — Puerto verbatim de SimulacionController::explain() línea 813 (rendimiento central esperado).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorRendimientoCentral implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuál es tu cosecha más probable?", 'tipo' => 'info',
             'contenido' => "El Rendimiento Central de **$valorConUnidad** es la cosecha más probable según todas las simulaciones de escenarios. No es el mejor ni el peor caso, sino el resultado que ocurre con mayor frecuencia bajo las condiciones actuales."],
            ['titulo' => "2. ¿Puedes planificar tus finanzas con este dato?", 'tipo' => 'success',
             'contenido' => "Sí. Usa **$valorConUnidad** como base para calcular tus ingresos y costos. Es el escenario más realista para presupuestar tu campaña en $nombreParcela."],
            ['titulo' => "3. ¿Cómo mejorar el rendimiento central?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Corrige tu factor limitante principal ($principalNombre) y optimiza la fecha de siembra para elevar el rendimiento central."]
        ];

        return $secciones;
    }
}
