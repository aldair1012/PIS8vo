<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorCascada.php — Puerto verbatim de SimulacionController::explain() línea 354 (cascada de brechas (gráfico)).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorCascada implements ExplicadorInterface
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
        $dg = $contexto['datos_grafico'];

        $secciones = [
            ['titulo' => "1. ¿Cuál es la limitante principal de tu lote?", 'tipo' => 'danger',
             'contenido' => "En tu parcela $nombreParcela, el factor que más frena tu cosecha es **$principalNombre** ($principalDetalle). Te resta **-$principalPerdida t/ha** del rendimiento potencial de $potencialMax t/ha."],
            ['titulo' => "2. ¿Cuánto dinero pierdes por esta limitante?", 'tipo' => 'warning',
             'contenido' => "Esa pérdida de -$principalPerdida t/ha equivale a dejar de ingresar **-$perdidaDolaresHa USD por hectárea** (al precio de $16.50 USD/qq, con 22 quintales por tonelada)."],
            ['titulo' => "3. ¿Qué puedes hacer para reducir esta brecha?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Enfoca tu inversión en corregir $principalNombre antes de agregar otros insumos, ya que es el cuello de botella que más impacto tiene en tu rendimiento."],
            ['titulo' => "4. Seguimiento recomendado", 'tipo' => 'info',
             'contenido' => "Después de aplicar la corrección, vuelve a correr la simulación para verificar que la brecha se redujo y que tu cosecha estimada subió."]
        ];

        return $secciones;
    }
}
