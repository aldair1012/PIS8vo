<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorPerdidaNitrogeno.php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorPerdidaNitrogeno implements ExplicadorInterface
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
        if ($variante === 0) {
            $s1 = "Estado actual del suelo ({$tipoSuelo}) en {$ubicacion}: pH {$phSuelo} (ideal 5.8-6.8), fertilizacion {$fertilizanteVal} kg/ha (recomendado 180), temperatura {$temperaturaVal} °C. {$principalDetalle}.";
        } else {
            $s1 = "En la parcela {$nombreParcela} ({$areaHa} ha), el suelo {$tipoSuelo} presenta pH {$phSuelo}, fertilizacion {$fertilizanteVal} kg/ha y temperatura {$temperaturaVal} °C: {$principalDetalle}.";
        }
        if ($variante === 0) {
            $s2 = "Impacto: {$principalNombre} te resta {$principalPerdida} t/ha (~{$perdidaDolaresHa} USD/ha) en {$areaHa} ha con variedad {$variedadMaiz}.";
        } else {
            $s2 = "Perdida por {$principalNombre}: {$principalPerdida} t/ha (~{$perdidaDolaresHa} USD/ha); ingreso en riesgo " . round($principalPerdida * $areaHa * 22 * 16.50, 2) . " USD.";
        }
        if ($variante === 0) {
            $s3 = "Correccion: aplica cal agricola 2 t/ha en pre-siembra si el pH es menor a 5.8; urea 180 kg/ha fraccionada (60% siembra, 40% V6); materia organica 5 t/ha. Cierre: realiza analisis de suelo post-cosecha y re-simula.";
        } else {
            $s3 = "Siguiente paso: corrige {$principalNombre} con el producto y dosis indicados, fracciona la fertilizacion y monitorea el pH. Cierra con un nuevo analisis de suelo y simulacion.";
        }
        $secciones = [
            ['titulo' => $variante === 0 ? "1. Estado actual" : "1. Diagnostico del suelo", 'tipo' => 'info', 'contenido' => $s1],
            ['titulo' => $variante === 0 ? "2. Impacto" : "2. Perdida estimada", 'tipo' => ($principalPerdida > 1.0 ? 'warning' : 'success'), 'contenido' => $s2],
            ['titulo' => $variante === 0 ? "3. Correccion" : "3. Plan de correccion", 'tipo' => 'success', 'contenido' => $s3],
        ];
        return $secciones;

    }
}
