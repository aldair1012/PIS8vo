<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorIngresoBruto.php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorIngresoBruto implements ExplicadorInterface
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
        $ingresoTotal = round($rendPredichoVal * $areaHa * 22 * 16.50, 2);
        $opt = round($rendPredichoVal * 1.15, 2);
        $pes = round($rendPredichoVal * 0.85, 2);
        if ($variante === 0) {
            $s1 = "Tu indicador {$nombre} registra {$valorConUnidad} para {$areaHa} ha en {$ubicacion} con la variedad {$variedadMaiz}: rendimiento {$rendPredichoVal} t/ha e ingreso bruto estimado de {$ingresoTotal} USD a 16.50 USD/qq.";
        } else {
            $s1 = "En la parcela {$nombreParcela} ({$areaHa} ha), {$nombre} = {$valorConUnidad}; con {$rendPredichoVal} t/ha el ingreso bruto alcanza {$ingresoTotal} USD. Factor limitante: {$principalNombre} ({$principalPerdida} t/ha).";
        }
        if ($variante === 0) {
            $s2 = "Escenarios: base {$rendPredichoVal} t/ha ({$ingresoTotal} USD); optimista {$opt} t/ha (" . round($opt * $areaHa * 22 * 16.50, 2) . " USD); pesimista {$pes} t/ha (" . round($pes * $areaHa * 22 * 16.50, 2) . " USD).";
        } else {
            $s2 = "Rango de resultado: de {$pes} t/ha (pesimista) a {$opt} t/ha (optimista), con base en {$rendPredichoVal} t/ha. Cada 0.5 t/ha equivale a " . round(0.5 * $areaHa * 22 * 16.50, 2) . " USD.";
        }
        $rec = !empty($recomendacionBase) ? $recomendacionBase : "reduce costos variables, asegura precio minimo antes de la siembra y protege el margen con cobertura de insumos.";
        if ($variante === 0) {
            $s3 = "Riesgo financiero: el factor que mas afecta es {$principalNombre} ({$principalPerdida} t/ha, ~{$perdidaDolaresHa} USD/ha). Recomendacion: {$rec} Cierre: valida el flujo de caja mensual y el punto de equilibrio antes de sembrar.";
        } else {
            $s3 = "Sensibilidad: una perdida de {$principalPerdida} t/ha por {$principalNombre} cuesta ~{$perdidaDolaresHa} USD/ha. Accion: {$rec} Cierra con una re-simulacion del escenario pesimista.";
        }
        $secciones = [
            ['titulo' => $variante === 0 ? "1. Inversion y retorno" : "1. Resultado financiero", 'tipo' => 'info', 'contenido' => $s1],
            ['titulo' => $variante === 0 ? "2. Escenarios" : "2. Rango de resultados", 'tipo' => 'info', 'contenido' => $s2],
            ['titulo' => $variante === 0 ? "3. Riesgo financiero" : "3. Sensibilidad", 'tipo' => ($nivelText === 'riesgoso' ? 'warning' : 'success'), 'contenido' => $s3],
        ];
        return $secciones;

    }
}
