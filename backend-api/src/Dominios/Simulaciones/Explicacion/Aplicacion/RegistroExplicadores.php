<?php
// src/Dominios/Simulaciones/Explicacion/Aplicacion/RegistroExplicadores.php — Lista ORDENADA de reglas: el orden ES el contrato de evaluación (if/elseif legacy).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion;

final class RegistroExplicadores
{
    /**
     * Reglas de SimulacionController::explain() (líneas 354–901) en SU orden original.
     * Cada regla: 'explicador' (clase), 'condicion' (strpos literal del archivo original),
     * 'grafico' => true solo si el bloque original solo corre con datos_grafico (líneas 350–426)
     * y 'extra' para condiciones adicionales (p. ej. ExplicadorCurvaTemporal exige $dg['labels']).
     * ExplicadorDefault no lleva 'condicion': es el fallback final si ninguna regla coincidió.
     *
     * @return list<array<string, mixed>>
     */
    public function reglas(): array
    {
        return [
            // --- BLOQUE GRÁFICO (solo con datos_grafico; líneas 350–426) ---
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorCascada::class,
                'condicion'  => ['cualquiera' => ['cascada', 'brecha', 'limitante', 'contribuci']],
                'grafico'    => true,
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorCurvaTemporal::class,
                'condicion'  => ['cualquiera' => ['curva']],
                'grafico'    => true,
                'extra'      => static fn (array $contexto): bool => isset($contexto['datos_grafico']['labels']),
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorDistribucionProbabilistica::class,
                'condicion'  => ['cualquiera' => ['gauss', 'probabil', 'distribuc']],
                'grafico'    => true,
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorSensibilidad::class,
                'condicion'  => ['cualquiera' => ['sensibilidad']],
                'grafico'    => true,
            ],

            // --- TARJETAS INDIVIDUALES POR TIPO (líneas 431–910) ---
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorPotencialGenetico::class,
                'condicion'  => ['cualquiera' => ['potencial', 'genético', 'genetico', 'límite genético']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorRadiacionFotosintetica::class,
                'condicion'  => ['cualquiera' => ['radiación', 'radiacion', 'par', 'fotosint']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorRendimientoAlcanzable::class,
                'condicion'  => ['cualquiera' => ['alcanzable']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorCapacidadSuelo::class,
                'condicion'  => ['todas' => ['capacidad', 'suelo']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorAguaUtil::class,
                'condicion'  => ['cualquiera' => ['agua', 'hídric', 'hidric', 'balance']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorRendimientoPredicho::class,
                'condicion'  => ['cualquiera' => ['predicho', 'estimado', 'cosecha esperada']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorProbabilidadCosecha::class,
                'condicion'  => ['y' => [
                    ['cualquiera' => ['probabilidad']],
                    ['cualquiera' => ['cosecha', 'éxito', 'exito']],
                ]],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorIndiceCosecha::class,
                'condicion'  => ['cualquiera' => ['índice de cosecha', 'indice de cosecha', 'harvest']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorYieldGap::class,
                'condicion'  => ['cualquiera' => ['gap', 'brecha']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorPerdidaAgua::class,
                'condicion'  => ['y' => [
                    ['cualquiera' => ['pérdida']],
                    ['cualquiera' => ['agua', 'hídric', 'hidric']],
                ]],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorPerdidaNitrogeno::class,
                'condicion'  => ['y' => [
                    ['cualquiera' => ['pérdida']],
                    ['cualquiera' => ['nitrógeno']],
                ]],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorLimitantePrincipal::class,
                'condicion'  => ['cualquiera' => ['limitante', 'cuello']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorAccionPrioritaria::class,
                'condicion'  => ['cualquiera' => ['acción', 'accion', 'prioritaria', 'correctora']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorFaseFenologica::class,
                'condicion'  => ['cualquiera' => ['fase', 'fenológ', 'fenolog', 'floración', 'floracion', 'emergencia', 'crecimiento', 'vegetativo', 'espigado']],
            ],
            // ====== TARJETAS FINANCIERAS ======
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorROI::class,
                'condicion'  => ['cualquiera' => ['roi', 'retorno']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorMargenNeto::class,
                'condicion'  => ['cualquiera' => ['margen', 'ganancia']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorIngresoBruto::class,
                'condicion'  => ['cualquiera' => ['ingreso']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorCostoTotal::class,
                'condicion'  => ['cualquiera' => ['costo', 'insumos', 'costos fijos']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorBeneficioCosto::class,
                'condicion'  => ['cualquiera' => ['beneficio', 'b/c']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorPuntoEquilibrio::class,
                'condicion'  => ['cualquiera' => ['equilibrio', 'break']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorPrecioMinimo::class,
                'condicion'  => ['y' => [
                    ['cualquiera' => ['precio']],
                    ['cualquiera' => ['mínimo', 'minimo', 'piso']],
                ]],
            ],
            [
                // INALCANZABLE en legacy: sombreada por ExplicadorMargenNeto (token 'margen',
                // más arriba en el if/elseif). Preservada por paridad — NO borrar ni "arreglar".
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorMargenSeguridad::class,
                'condicion'  => ['cualquiera' => ['seguridad']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorNivelConfianza::class,
                'condicion'  => ['cualquiera' => ['confianza', 'monte carlo']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorRiesgoFinanciero::class,
                'condicion'  => ['cualquiera' => ['riesgo']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorPerfilesProduccion::class,
                'condicion'  => ['cualquiera' => ['perfiles', 'modelos de producción', 'modelos de produccion']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorTIR::class,
                'condicion'  => ['cualquiera' => ['tir', 'tasa interna']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorGananciaPorDolar::class,
                'condicion'  => ['cualquiera' => ['dólar', 'dolar']],
            ],
            // ====== TARJETAS CLIMATICAS ======
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorENSO::class,
                'condicion'  => ['cualquiera' => ['enso', 'niño', 'oscilación', 'oscilacion']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorLluviaPromedio::class,
                'condicion'  => ['todas' => ['lluvia', 'promedio']],
            ],
            [
                // INALCANZABLE en legacy: sombreada por ExplicadorAguaUtil (token 'agua',
                // más arriba en el if/elseif; 'agua'+'inicial' siempre la alcanza antes).
                // Preservada por paridad — NO borrar ni "arreglar".
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorAguaInicial::class,
                'condicion'  => ['todas' => ['agua', 'inicial']],
            ],
            [
                // INALCANZABLE en legacy: sombreada por ExplicadorRiesgoFinanciero (token 'riesgo',
                // más arriba en el if/elseif). Preservada por paridad — NO borrar ni "arreglar".
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorRiesgoEstacional::class,
                'condicion'  => ['cualquiera' => ['riesgo estacional', 'riesgo compuesto', 'riesgo agronómico', 'riesgo agronomico']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorDesviacionMensual::class,
                'condicion'  => ['cualquiera' => ['desviación', 'desviacion', 'anomalía', 'anomalia']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorAguaPorEstrato::class,
                'condicion'  => ['cualquiera' => ['estrato']],
            ],
            // ====== TARJETAS ESCENARIOS ======
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorRendimientoCentral::class,
                'condicion'  => ['todas' => ['central', 'esperado']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorSuperarObjetivo::class,
                'condicion'  => ['y' => [
                    ['cualquiera' => ['superar']],
                    ['cualquiera' => ['objetivo', 'equilibrio']],
                ]],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorEstabilidad::class,
                'condicion'  => ['cualquiera' => ['estabilidad']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorFechaSiembra::class,
                'condicion'  => ['todas' => ['fecha', 'siembra']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorMesEspecifico::class,
                'condicion'  => ['cualquiera' => ['mes de']],
            ],
            [
                // INALCANZABLE en legacy: sombreada por ExplicadorRadiacionFotosintetica (token
                // 'par', que es subcadena de "comparador" — strpos del legacy la gana siempre
                // para 'comparador'; 'híbridos' solo era alcanzable). Preservada por paridad.
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorComparadorHibridos::class,
                'condicion'  => ['cualquiera' => ['comparador', 'híbridos', 'hibridos']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorEstrategia::class,
                'condicion'  => ['cualquiera' => ['estrategia']],
            ],
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorGraficoGenerico::class,
                'condicion'  => ['cualquiera' => ['gráfico', 'grafico', 'distribución', 'distribucion']],
            ],
            // --- DEFAULT: última red antes del fallback (línea 901) ---
            [
                'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorDefault::class,
            ],
        ];
    }
}
