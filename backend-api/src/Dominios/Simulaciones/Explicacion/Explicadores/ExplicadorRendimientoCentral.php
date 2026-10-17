<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorRendimientoCentral.php
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

        $variante = crc32((string)($contexto['nombre'] ?? '')) % 2;
        $gap = round($potencialMax - $rendPredichoVal, 2);
        if ($variante === 0) {
            $s1 = "En {$ubicacion}, tu rendimiento estimado es {$rendPredichoVal} t/ha frente a un potencial de {$potencialMax} t/ha: te faltan {$gap} t/ha, equivalentes a " . round($gap * $areaHa * 22 * 16.50, 2) . " USD en {$areaHa} ha con la variedad {$variedadMaiz}.";
        } else {
            $s1 = "Para la parcela {$nombreParcela} ({$areaHa} ha, {$variedadMaiz}), el modelo proyecta {$rendPredichoVal} t/ha contra un techo de {$potencialMax} t/ha en {$ubicacion}: brecha de {$gap} t/ha = " . round($gap * $areaHa * 22 * 16.50, 2) . " USD.";
        }
        $lossesText = "Nitrogeno: {$lossN} t/ha; Lluvia: {$lossWater} t/ha; pH: {$lossPh} t/ha; Temperatura: {$lossTemp} t/ha.";
        if ($variante === 0) {
            $s2 = "Factores limitantes (perdida en t/ha): {$lossesText} El principal es {$principalNombre} ({$principalDetalle}), que te resta {$principalPerdida} t/ha (~{$perdidaDolaresHa} USD/ha).";
        } else {
            $s2 = "El factor que mas te resta es {$principalNombre}: {$principalDetalle}, con {$principalPerdida} t/ha de perdida (~{$perdidaDolaresHa} USD/ha). Desglose: {$lossesText}";
        }
        if ($variante === 0) {
            $s3 = "Accion concreta: corrige primero {$principalNombre}; aplica urea 180 kg/ha fraccionada (60% siembra, 40% V6), asegura 750 mm de agua total y cal agricola 2 t/ha en pre-siembra si el pH es menor a 5.8. Cierre: monitorea semanalmente y re-simula antes de la siembra.";
        } else {
            $s3 = "Siguiente paso: ataca {$principalNombre} ({$principalDetalle}) con dosis y fecha segun recomendacion tecnica; despues optimiza los demas factores para ganar hasta {$gap} t/ha. Cierra con una nueva simulacion del escenario.";
        }
        $secciones = [
            ['titulo' => $variante === 0 ? "1. Potencial vs. realidad" : "1. Brecha de rendimiento", 'tipo' => 'info', 'contenido' => $s1],
            ['titulo' => $variante === 0 ? "2. Factores limitantes" : "2. Donde se pierde", 'tipo' => ($principalPerdida > 1.0 ? 'warning' : 'success'), 'contenido' => $s2],
            ['titulo' => $variante === 0 ? "3. Accion concreta" : "3. Plan de mejora", 'tipo' => 'success', 'contenido' => $s3],
        ];
        return $secciones;

    }
}
