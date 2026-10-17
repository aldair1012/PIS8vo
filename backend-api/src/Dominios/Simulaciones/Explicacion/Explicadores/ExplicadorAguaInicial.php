<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorAguaInicial.php — Puerto verbatim de SimulacionController::explain() línea 768 (agua útil inicial en suelo).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorAguaInicial implements ExplicadorInterface
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
            ['titulo' => "1. ¿Cuánta agua tiene tu suelo ahora?", 'tipo' => 'info',
             'contenido' => "Tu suelo $tipoSuelo en $nombreParcela tiene actualmente **$valorConUnidad** de agua útil disponible para las raíces. Esta reserva es la que las plantas consumirán mientras no llueva."],
            ['titulo' => "2. ¿Es suficiente para arrancar el cultivo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : ($nivelText === 'favorable' ? "Sí. Tu suelo arranca con buena reserva hídrica para las primeras semanas del cultivo." : "No es ideal. Las primeras semanas son cruciales y la falta de humedad puede afectar la germinación uniformemente.")],
            ['titulo' => "3. ¿Qué hacer si el suelo está seco?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Riega antes de la siembra para llevar el suelo a capacidad de campo y asegura que las semillas germinen uniformemente."]
        ];

        return $secciones;
    }
}
