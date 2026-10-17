<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorLluviaPromedio.php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorLluviaPromedio implements ExplicadorInterface
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
            $s1 = "Fenomeno climatico: {$nombre} = {$valorConUnidad} en {$ubicacion}; temperatura {$temperaturaVal} °C, lluvia {$precipitacionVal} mm y humedad {$humedadVal}%.";
        } else {
            $s1 = "En la parcela {$nombreParcela} ({$areaHa} ha, {$variedadMaiz}), {$nombre} registra {$valorConUnidad}; condiciones: {$temperaturaVal} °C, {$precipitacionVal} mm de lluvia y {$humedadVal}% de humedad.";
        }
        if ($variante === 0) {
            $s2 = "Impacto en tu cultivo: {$principalDetalle}; perdida estimada de {$principalPerdida} t/ha (~{$perdidaDolaresHa} USD/ha) si no se corrige a tiempo.";
        } else {
            $s2 = "El clima te resta {$principalPerdida} t/ha (~{$perdidaDolaresHa} USD/ha) por {$principalNombre}: {$principalDetalle}. Ingreso en riesgo: " . round($principalPerdida * $areaHa * 22 * 16.50, 2) . " USD.";
        }
        if ($variante === 0) {
            $s3 = "Ventana de accion: ajusta la fecha de siembra y la variedad segun el pronostico ENSO; monitorea a 7-10 dias; prepara un plan de contingencia hidrica y de drenaje. Cierre: re-simula el escenario antes de sembrar.";
        } else {
            $s3 = "Siguiente paso: define la ventana de siembra optima segun el pronostico, prepara reserva de agua y drenaje; monitorea cada 7 dias. Cierra con una nueva simulacion del escenario climatico.";
        }
        $secciones = [
            ['titulo' => $variante === 0 ? "1. Fenomeno" : "1. Condicion climatica", 'tipo' => 'info', 'contenido' => $s1],
            ['titulo' => $variante === 0 ? "2. Impacto en tu cultivo" : "2. Efecto sobre el rendimiento", 'tipo' => ($principalPerdida > 1.0 ? 'warning' : 'success'), 'contenido' => $s2],
            ['titulo' => $variante === 0 ? "3. Ventana de accion" : "3. Que hacer y cuando", 'tipo' => 'success', 'contenido' => $s3],
        ];
        return $secciones;

    }
}
