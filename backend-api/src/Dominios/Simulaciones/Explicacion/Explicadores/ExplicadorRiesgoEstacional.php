<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorRiesgoEstacional.php — Puerto verbatim de SimulacionController::explain() línea 779 (índice de riesgo estacional).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorRiesgoEstacional implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué mide el Índice de Riesgo de $valorConUnidad?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
             'contenido' => "Este índice combina el riesgo de sequía, calor extremo, exceso de lluvia y deficiencia nutricional en un solo número. Un valor de **$valorConUnidad** " . ($nivelText === 'favorable' ? "indica que las condiciones generales son estables para tu cultivo." : "indica que varios factores de riesgo coinciden en esta temporada y debes estar alerta.")],
            ['titulo' => "2. ¿Qué factores pesan más en el riesgo?", 'tipo' => 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : "Para tu zona de $ubicacion, los factores de mayor peso son: lluvia ($precipitacionVal mm), temperatura ($temperaturaVal °C) y la fertilización aplicada ($fertilizanteVal kg/ha de N)."],
            ['titulo' => "3. ¿Cómo bajar el riesgo estacional?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Diversifica las fechas de siembra, asegura riego complementario y mantén reserva de insumos para aplicar fertilización de emergencia si es necesario."]
        ];

        return $secciones;
    }
}
