<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorRendimientoAlcanzable.php — Puerto verbatim de SimulacionController::explain() línea 456 (rendimiento alcanzable).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorRendimientoAlcanzable implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué es el Rendimiento Alcanzable de $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "A diferencia del potencial genético, el rendimiento alcanzable de **$valorConUnidad** ya considera las limitaciones reales de tu suelo $tipoSuelo y el clima de $ubicacion. Es la meta realista que puedes lograr con buen manejo."],
            ['titulo' => "2. ¿Estás cerca de alcanzarlo?", 'tipo' => $rendPredichoVal >= floatval(str_replace([' t/ha', ' '], '', $valor)) * 0.85 ? 'success' : 'warning',
             'contenido' => "Tu cosecha estimada de **$rendPredichoVal t/ha** representa el **" . round(($rendPredichoVal / max(0.1, floatval(str_replace([' t/ha', ' '], '', $valor)))) * 100, 0) . "%** de lo alcanzable. " . ($rendPredichoVal >= floatval(str_replace([' t/ha', ' '], '', $valor)) * 0.85 ? "Estás en buen camino." : "Hay espacio para mejorar optimizando tu factor limitante.")],
            ['titulo' => "3. ¿Qué falta para alcanzar los $valorConUnidad?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Ajusta la fertilización a 180 kg/ha de Nitrógeno fraccionado y asegura riegos complementarios si la lluvia está por debajo de 600 mm en tu zona."]
        ];

        return $secciones;
    }
}
