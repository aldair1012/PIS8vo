<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorENSO.php — Puerto verbatim de SimulacionController::explain() línea 746 (ENSO / El Niño).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorENSO implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué indica el estado ENSO actual?", 'tipo' => 'info',
             'contenido' => "El fenómeno ENSO (El Niño / La Niña) está actualmente en fase **$valor**. Este fenómeno oceánico-atmosférico cambia los patrones de lluvia y temperatura en toda la costa ecuatoriana y sierra, afectando directamente tu cultivo."],
            ['titulo' => "2. ¿Cómo afecta a tu maíz en $ubicacion?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "En fase Neutral, las lluvias siguen un patrón normal. En El Niño, hay exceso de lluvias en la costa y sequía en la sierra. En La Niña, ocurre lo contrario."],
            ['titulo' => "3. ¿Qué precauciones tomar?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Consulta los pronósticos estacionales del INAMHI antes de definir tu fecha de siembra y ajusta la densidad de siembra según la previsión de lluvias."]
        ];

        return $secciones;
    }
}
