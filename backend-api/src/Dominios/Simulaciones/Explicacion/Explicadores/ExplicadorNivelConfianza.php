<?php
// src/Dominios/Simulaciones/Explicacion/Explicadores/ExplicadorNivelConfianza.php — Puerto verbatim de SimulacionController::explain() línea 690 (confianza monte carlo / nivel de confianza).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\ExplicadorInterface;

final class ExplicadorNivelConfianza implements ExplicadorInterface
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
            ['titulo' => "1. ¿Qué indica un Nivel de Confianza del $valorConUnidad?", 'tipo' => 'info',
             'contenido' => "El simulador corrió miles de escenarios combinando diferentes condiciones de clima y precios. En el **$valorConUnidad** de esos escenarios, tu cultivo logra al menos el rendimiento estimado. Es la probabilidad de que tu inversión salga bien."],
            ['titulo' => "2. ¿Puedes confiar en este número?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
             'contenido' => !empty($impactoBase) ? $impactoBase : ($nivelText === 'favorable' ? "Sí. Un nivel alto significa que la mayoría de escenarios posibles son favorables para tu cultivo." : "El nivel sugiere que hay bastantes escenarios donde podrías tener pérdidas. Revisa tus variables de entrada.")],
            ['titulo' => "3. ¿Cómo mejorar la confianza?", 'tipo' => 'success',
             'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Reduce la variabilidad de tus condiciones: asegura riego, usa semilla certificada y corrige la nutrición para tener resultados más predecibles."]
        ];

        return $secciones;
    }
}
