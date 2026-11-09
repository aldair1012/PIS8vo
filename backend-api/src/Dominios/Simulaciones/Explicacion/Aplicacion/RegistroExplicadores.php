<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion;

/** Coincidencias específicas antes de las generales; todos los indicadores validan su evidencia. */
final class RegistroExplicadores
{
    public function reglas(): array
    {
        $reglas = [
            ['Cascada', ['cualquiera' => ['cascada', 'contribuci']]],
            ['CurvaTemporal', ['cualquiera' => ['curva', 'serie temporal', 'timeline']]],
            ['Sensibilidad', ['cualquiera' => ['sensibilidad']]],
            ['DistribucionProbabilistica', ['cualquiera' => ['gauss', 'distribuci', 'percentil']]],
            ['ComparadorHibridos', ['cualquiera' => ['comparador', 'comparacion de hibridos', 'comparacion de variedades']]],
            ['AguaPorEstrato', ['cualquiera' => ['estrato']]],
            ['RiesgoEstacional', ['cualquiera' => ['riesgo estacional', 'riesgo compuesto', 'riesgo agronomico']]],
            ['MargenSeguridad', ['cualquiera' => ['margen de seguridad']]],
            ['AguaInicial', ['todas' => ['agua', 'inicial']]],
            ['PerdidaAgua', ['y' => [['cualquiera' => ['perdida', 'aporte']], ['cualquiera' => ['agua', 'hidric', 'precipitacion']]]]],
            ['PerdidaNitrogeno', ['y' => [['cualquiera' => ['perdida', 'aporte']], ['cualquiera' => ['nitrogeno', 'fertilizante']]]]],
            ['RendimientoCentral', ['y' => [['cualquiera' => ['rendimiento', 'central']], ['cualquiera' => ['central', 'mediana']]]]],
            ['IndiceCosecha', ['cualquiera' => ['indice de cosecha', 'harvest']]],
            ['ProbabilidadCosecha', ['y' => [['cualquiera' => ['probabilidad']], ['cualquiera' => ['cosecha', 'exito']]]]],
            ['SuperarObjetivo', ['cualquiera' => ['superar', 'sobre el punto de equilibrio']]],
            ['GananciaPorDolar', ['cualquiera' => ['por dolar']]],
            ['PrecioMinimo', ['y' => [['cualquiera' => ['precio']], ['cualquiera' => ['minimo', 'piso']]]]],
            ['RendimientoAlcanzable', ['cualquiera' => ['alcanzable']]],
            ['PotencialGenetico', ['cualquiera' => ['potencial', 'genetico']]],
            ['RadiacionFotosintetica', ['o' => [['cualquiera' => ['radiacion', 'fotosint']], ['patron' => '/(?:^|\W)par(?:$|\W)/u']]]],
            ['CapacidadSuelo', ['todas' => ['capacidad', 'suelo']]],
            ['AguaUtil', ['cualquiera' => ['agua', 'hidric', 'balance']]],
            ['YieldGap', ['cualquiera' => ['gap', 'brecha']]],
            ['LimitantePrincipal', ['cualquiera' => ['limitante', 'cuello']]],
            ['AccionPrioritaria', ['cualquiera' => ['accion', 'prioritaria', 'correctora']]],
            ['FaseFenologica', ['cualquiera' => ['fase', 'fenolog', 'floracion', 'emergencia', 'crecimiento', 'vegetativo', 'espigado', 'etapa:']]],
            ['ROI', ['cualquiera' => ['roi', 'retorno de inversion']]],
            ['MargenNeto', ['cualquiera' => ['margen', 'ganancia']]],
            ['IngresoBruto', ['cualquiera' => ['ingreso']]],
            ['BeneficioCosto', ['cualquiera' => ['beneficio', 'b/c']]],
            ['CostoTotal', ['cualquiera' => ['costo', 'insumos']]],
            ['PuntoEquilibrio', ['cualquiera' => ['equilibrio', 'break']]],
            ['NivelConfianza', ['cualquiera' => ['confianza', 'monte carlo']]],
            ['RiesgoFinanciero', ['cualquiera' => ['riesgo financiero', 'riesgo de perdida']]],
            ['PerfilesProduccion', ['cualquiera' => ['perfiles', 'modelos de produccion']]],
            ['TIR', ['cualquiera' => ['tir', 'tasa interna']]],
            ['ENSO', ['cualquiera' => ['enso', 'nino', 'oscilacion']]],
            ['LluviaPromedio', ['cualquiera' => ['lluvia', 'precipitacion']]],
            ['DesviacionMensual', ['cualquiera' => ['desviacion', 'anomalia']]],
            ['Estabilidad', ['cualquiera' => ['estabilidad']]],
            ['FechaSiembra', ['todas' => ['fecha', 'siembra']]],
            ['MesEspecifico', ['cualquiera' => ['mes de']]],
            ['Estrategia', ['cualquiera' => ['estrategia']]],
            ['RendimientoPredicho', ['cualquiera' => ['predicho', 'rendimiento estimado', 'cosecha esperada']]],
            ['GraficoGenerico', ['cualquiera' => ['grafico']]],
        ];
        $salida = [];
        foreach ($reglas as [$clave, $condicion]) $salida[] = ['explicador' => 'ZeaSys\\Dominios\\Simulaciones\\Explicacion\\Explicadores\\Explicador' . $clave, 'condicion' => $condicion];
        $salida[] = ['explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorDefault::class];
        return $salida;
    }
}
