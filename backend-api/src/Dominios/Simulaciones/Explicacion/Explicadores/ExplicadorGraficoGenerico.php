<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorGraficoGenerico.php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorGraficoGenerico implements ExplicadorInterface
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
        $desc = !empty($descripcionTecnica) ? $descripcionTecnica : "indicador de desempeno del sistema";
        $imp = !empty($impactoBase) ? $impactoBase : "afecta directamente el rendimiento final";
        $rec = !empty($recomendacionBase) ? $recomendacionBase : "optimiza {$principalNombre} y re-simula el escenario.";
        if ($variante === 0) {
            $s1 = "El indicador {$nombre} registra {$valorConUnidad} en {$ubicacion} ({$areaHa} ha, {$variedadMaiz}). {$desc}.";
        } else {
            $s1 = "En la parcela {$nombreParcela}, {$nombre} = {$valorConUnidad}; {$desc}. Condiciones: {$temperaturaVal} °C, {$precipitacionVal} mm, pH {$phSuelo}.";
        }
        if ($variante === 0) {
            $s2 = "Importa porque {$imp}. El factor limitante principal es {$principalNombre} ({$principalPerdida} t/ha, ~{$perdidaDolaresHa} USD/ha).";
        } else {
            $s2 = "Impacto: {$imp}. Principal cuello de botella: {$principalNombre} con {$principalPerdida} t/ha de perdida (~{$perdidaDolaresHa} USD/ha).";
        }
        if ($variante === 0) {
            $s3 = "Accion: {$rec} Cierre: monitorea el indicador y ajusta antes de la siguiente etapa fenologica.";
        } else {
            $s3 = "Siguiente paso: {$rec} Cierra con una re-simulacion y seguimiento semanal.";
        }
        $secciones = [
            ['titulo' => $variante === 0 ? "1. Que significa?" : "1. Definicion y valor", 'tipo' => 'info', 'contenido' => $s1],
            ['titulo' => $variante === 0 ? "2. Por que importa?" : "2. Impacto en el cultivo", 'tipo' => ($nivelText === 'riesgoso' ? 'warning' : 'success'), 'contenido' => $s2],
            ['titulo' => $variante === 0 ? "3. Que hacer?" : "3. Accion recomendada", 'tipo' => 'success', 'contenido' => $s3],
        ];
        return $secciones;

    }
}
