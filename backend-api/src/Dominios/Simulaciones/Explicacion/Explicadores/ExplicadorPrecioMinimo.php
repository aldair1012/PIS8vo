<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorPrecioMinimo.php — Puerto verbatim de SimulacionController::explain() línea 666 (precio mínimo de venta).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorPrecioMinimo implements ExplicadorInterface
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
            ['titulo' => "1. ¿A cuánto mínimo debes vender tu maíz?", 'tipo' => 'info',
             'contenido' => "Para cubrir todos los costos de producción de tu parcela $nombreParcela, necesitas vender cada quintal a un precio mínimo de **$valorConUnidad**. Si vendes por debajo de este precio, pierdes dinero."],
            ['titulo' => "2. ¿El precio de mercado actual cubre tu piso?", 'tipo' => floatval(str_replace(['USD/qq', ' ', '$'], '', $valor)) <= 16.50 ? 'success' : 'danger',
             'contenido' => floatval(str_replace(['USD/qq', ' ', '$'], '', $valor)) <= 16.50
                ? "Sí. El precio de referencia de $16.50 USD/qq está por encima de tu precio piso, así que deberías obtener ganancia."
                : "Cuidado. Tu precio piso es alto y el mercado podría no cubrirlo. Necesitas reducir costos o aumentar el rendimiento para bajar tu precio de sustentación."],
            ['titulo' => "3. Estrategia de venta recomendada", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Negocia contratos de compra anticipada con un precio mínimo garantizado y almacena parte de la cosecha para vender cuando el precio suba."]
        ];

        return $secciones;
    }
}
