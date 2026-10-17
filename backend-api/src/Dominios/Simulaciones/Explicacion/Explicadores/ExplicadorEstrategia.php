<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorEstrategia.php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorEstrategia implements ExplicadorInterface
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

        $variante = crc32((string)($contexto['nombre'] ?? '')) % 2;
        $desc = !empty($descripcionTecnica) ? $descripcionTecnica : "sin descripcion tecnica adicional";
        $imp = !empty($impactoBase) ? $impactoBase : "impacto moderado sobre el rendimiento";
        $rec = !empty($recomendacionBase) ? $recomendacionBase : "aplica el control segun el umbral de accion con dosis de etiqueta y rota los modos de accion.";
        if ($variante === 0) {
            $s1 = "Riesgo identificado: {$nombre} = {$valorConUnidad} en {$ubicacion}. {$desc}. Impacto base: {$imp}.";
        } else {
            $s1 = "En la parcela {$nombreParcela} ({$areaHa} ha), {$nombre} registra {$valorConUnidad}: {$desc}. Impacto estimado: {$imp}.";
        }
        if ($variante === 0) {
            $s2 = "Control recomendado: {$rec} Momento: al alcanzar el umbral de accion; dosis segun etiqueta y rotacion de modos de accion.";
        } else {
            $s2 = "Accion de control: {$rec} Aplica en la ventana optima y verifica la eficacia a los 7 dias.";
        }
        if ($variante === 0) {
            $s3 = "Prevencion: monitoreo semanal, control biologico, rotacion de cultivos y eliminacion de residuos. Cierre: registra la incidencia y re-evalua en 7 dias.";
        } else {
            $s3 = "Siguiente paso: implementa monitoreo semanal, control biologico y rotacion; registra incidencias. Cierra con una re-evaluacion en 7 dias.";
        }
        $secciones = [
            ['titulo' => $variante === 0 ? "1. Riesgo identificado" : "1. Diagnostico de riesgo", 'tipo' => ($nivelText === 'riesgoso' ? 'danger' : 'warning'), 'contenido' => $s1],
            ['titulo' => $variante === 0 ? "2. Control recomendado" : "2. Plan de control", 'tipo' => 'success', 'contenido' => $s2],
            ['titulo' => $variante === 0 ? "3. Prevencion" : "3. Medidas preventivas", 'tipo' => 'info', 'contenido' => $s3],
        ];
        return $secciones;

    }
}
