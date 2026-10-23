<?php
// src/Dominios/Chat/Aplicacion/ContextoAgricolaService.php — Contexto combinado para el asistente.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Aplicacion;

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate;
use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaFinancial;
use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield;
use ZeaSys\Dominios\Analitica\Aplicacion\ServicioPrecioMaiz;
use ZeaSys\Kernel\Peticion;

/**
 * Reúne una fotografía pequeña y verificable de la parcela para que el
 * asistente pueda responder preguntas que cruzan clima, rendimiento, margen,
 * suelo, nutrición y precio sin depender de que el panel visible sea el único
 * contexto. Cada bloque es opcional: si una fuente falla, se omite en lugar de
 * inventar datos.
 */
final class ContextoAgricolaService
{
    public function __construct(
        private ServicioAnaliticaClimate $clima,
        private ServicioAnaliticaYield $rendimiento,
        private ServicioAnaliticaFinancial $finanzas,
        private ServicioPrecioMaiz $precioMaiz,
    ) {
    }

    /**
     * @param array<int, array<string, mixed>> $simulacionesRecientes
     * @return array<string, mixed>
     */
    public function construir(int $usuarioId, int $cultivoId, ?int $anio, array $simulacionesRecientes = []): array
    {
        $contexto = [];
        $precio = $this->precioMaiz->obtener();
        $contexto['precio_maiz'] = $this->compactarPrecio($precio);

        $clima = $this->seguro(fn (): mixed => $this->clima->construir($usuarioId, $cultivoId, $anio));
        if (is_array($clima) && !($clima['sin_datos'] ?? false)) {
            $contexto['clima'] = $this->compactarClima($clima);
            $contexto['nutricion'] = $this->compactarNutricion($clima['nutricion'] ?? null);
        }

        $rendimiento = $this->seguro(fn (): mixed => $this->rendimiento->construir($usuarioId, $cultivoId, $anio));
        if (is_array($rendimiento) && !($rendimiento['sin_datos'] ?? false)) {
            $contexto['rendimiento'] = $this->compactarRendimiento($rendimiento);
        }

        // Se usa la misma configuración del dashboard financiero (sin overrides
        // de query) para que el margen del chat no contradiga el panel.
        $finanzas = $this->seguro(fn (): mixed => $this->finanzas->construir($usuarioId, $cultivoId, $anio, new Peticion('GET')));
        if (is_array($finanzas) && !($finanzas['sin_datos'] ?? false)) {
            $contexto['finanzas'] = $this->compactarFinanzas($finanzas);
        }

        $ultima = $simulacionesRecientes[0] ?? null;
        if (is_array($ultima)) {
            $contexto['simulacion_reciente'] = $this->compactarSimulacion($ultima);
        }

        $contexto['impacto_precio'] = $this->calcularImpactoPrecio($contexto, $precio);
        return $contexto;
    }

    /**
     * Reduce el payload del panel de clima a lo que el modelo necesita:
     * observación actual, pronóstico corto y promedio de 30 días separados.
     *
     * @param array<string, mixed> $clima
     * @return array<string, mixed>
     */
    private function compactarClima(array $clima): array
    {
        $hoy = is_array($clima['clima_hoy'] ?? null) ? $clima['clima_hoy'] : [];
        $actual = is_array($hoy['actual'] ?? null) ? $hoy['actual'] : null;
        $pronostico = [];
        // Formato compacto para que los 7 días quepan sin repetir nombres de
        // campo siete veces. El orden se declara en "formato_pronostico".
        foreach (array_slice(is_array($clima['pronostico_7d'] ?? null) ? $clima['pronostico_7d'] : [], 0, 7) as $dia) {
            if (!is_array($dia)) {
                continue;
            }
            $pronostico[] = [
                $dia['fecha'] ?? null,
                $dia['temp_max_c'] ?? null,
                $dia['temp_min_c'] ?? null,
                $dia['precipitacion_mm'] ?? null,
                $dia['prob_precipitacion_pct'] ?? null,
            ];
        }

        $promedio = is_array($clima['clima_promedio_30d'] ?? null)
            ? $clima['clima_promedio_30d']
            : (is_array($clima['clima_actual'] ?? null) ? $clima['clima_actual'] : []);

        $lluviaTotal = 0.0;
        $diasConLluvia = 0;
        $tmax = [];
        $tmin = [];
        foreach ($pronostico as $dia) {
            $lluvia = is_numeric($dia[3] ?? null) ? (float) $dia[3] : 0.0;
            $probabilidad = is_numeric($dia[4] ?? null) ? (float) $dia[4] : 0.0;
            $lluviaTotal += $lluvia;
            if ($lluvia > 0 || $probabilidad >= 50) {
                $diasConLluvia++;
            }
            if (is_numeric($dia[1] ?? null)) {
                $tmax[] = (float) $dia[1];
            }
            if (is_numeric($dia[2] ?? null)) {
                $tmin[] = (float) $dia[2];
            }
        }

        return [
            'disponible' => (bool) ($hoy['disponible'] ?? false),
            'actual' => $actual ? [
                'fecha_hora' => $actual['fecha_hora'] ?? null,
                'temperatura_c' => $actual['temperatura_c'] ?? null,
                'humedad_pct' => $actual['humedad_relativa_pct'] ?? null,
                'lluvia_mm' => $actual['precipitacion_mm'] ?? null,
                'viento_kmh' => $actual['viento_kmh'] ?? null,
                'descripcion' => $actual['descripcion'] ?? null,
            ] : null,
            'formato_pronostico' => '[fecha, tmax_c, tmin_c, lluvia_mm, prob_lluvia_pct]',
            'pronostico_7d' => $pronostico,
            'resumen_7d' => [
                'lluvia_total_mm' => round($lluviaTotal, 1),
                'dias_con_lluvia' => $diasConLluvia,
                'tmax_rango_c' => $tmax !== [] ? [min($tmax), max($tmax)] : null,
                'tmin_rango_c' => $tmin !== [] ? [min($tmin), max($tmin)] : null,
            ],
            'promedio_30d' => [
                'temperatura_c' => $promedio['temperatura'] ?? null,
                'humedad_pct' => $promedio['humedad'] ?? null,
                'precipitacion_30d_mm' => $promedio['precipitacion_30d'] ?? null,
                'precipitacion_anual_estimada_mm' => $promedio['precipitacion_anual_estimada'] ?? ($promedio['precipitacion'] ?? null),
            ],
            'fuente' => $hoy['fuente'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $precio
     * @return array<string, mixed>
     */
    private function compactarPrecio(array $precio): array
    {
        if (!($precio['disponible'] ?? false)) {
            return ['disponible' => false];
        }

        return [
            'disponible' => true,
            'unidad' => $precio['unidad'] ?? null,
            'piso' => $precio['piso'] ?? null,
            'techo' => $precio['techo'] ?? null,
            'promedio' => $precio['promedio'] ?? null,
            'vigencia' => 'Campaña 2026',
            'fuente' => 'MAGP (Consejo Consultivo Maíz)',
            'fecha_fuente' => $precio['fecha_fuente'] ?? null,
            'tipo' => 'Referencia oficial; no es precio de mercado en vivo',
        ];
    }

    /**
     * @param array<string, mixed>|null $nutricion
     * @return array<string, mixed>|null
     */
    private function compactarNutricion(?array $nutricion): ?array
    {
        if ($nutricion === null) {
            return null;
        }

        $fertilizacion = is_array($nutricion['fertilizacion_registrada'] ?? null)
            ? $nutricion['fertilizacion_registrada']
            : [];
        $tieneFertilizacion = array_filter($fertilizacion, static fn ($valor): bool => $valor !== null && $valor !== '') !== [];

        $salida = [
            'zona' => $nutricion['zona'] ?? null,
            'ph_suelo' => $nutricion['ph_suelo'] ?? null,
            'materia_organica_pct' => $nutricion['materia_organica_pct'] ?? null,
            'ph_optimo' => $nutricion['ph_optimo'] ?? null,
            'nitrogeno_kg_ha' => $nutricion['nitrogeno_recomendado_kg_ha'] ?? null,
            'fraccionamiento_n' => $nutricion['fraccionamiento_n'] ?? null,
            'biofertilizante' => $nutricion['biofertilizante'] ?? null,
            'nota' => 'Se requiere análisis de suelo antes de definir dosis de P, K o micronutrientes.',
        ];
        if ($tieneFertilizacion) {
            $salida['fertilizacion_registrada'] = $fertilizacion;
        }

        return $salida;
    }

    /**
     * @param array<string, mixed> $rendimiento
     * @return array<string, mixed>
     */
    private function compactarRendimiento(array $rendimiento): array
    {
        $kpis = is_array($rendimiento['kpis'] ?? null) ? $rendimiento['kpis'] : [];
        return [
            'kpis' => [
                'rendimiento_potencial' => $kpis['rendimiento_potencial'] ?? null,
                'rendimiento_alcanzable' => $kpis['rendimiento_alcanzable'] ?? null,
                'rendimiento_predicho' => $kpis['rendimiento_predicho'] ?? null,
                'yield_gap_total' => $kpis['yield_gap_total'] ?? null,
                'principal_limitante' => $kpis['principal_limitante'] ?? null,
                'fase_vulnerable' => $kpis['fase_vulnerable'] ?? null,
                'probabilidad_cosecha' => $kpis['probabilidad_cosecha'] ?? null,
                'agua_util' => $kpis['agua_util'] ?? null,
            ],
            'simulaciones_count' => $rendimiento['simulaciones_count'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $finanzas
     * @return array<string, mixed>
     */
    private function compactarFinanzas(array $finanzas): array
    {
        $kpis = is_array($finanzas['kpis'] ?? null) ? $finanzas['kpis'] : [];
        return [
            'kpis' => [
                'margen_neto_por_ha' => $kpis['margen_neto'] ?? null,
                'margen_neto_parcela' => $kpis['margen_neto_parcela'] ?? null,
                'punto_equilibrio' => $kpis['punto_equilibrio'] ?? null,
                'precio_maiz_qq' => $kpis['precio_maiz_qq'] ?? null,
                'produccion_total_qq' => $kpis['produccion_total_qq'] ?? null,
                'costo_total_parcela' => $kpis['costo_total_parcela'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $simulacion
     * @return array<string, mixed>
     */
    private function compactarSimulacion(array $simulacion): array
    {
        $recomendaciones = json_decode((string) ($simulacion['recomendaciones_json'] ?? ''), true);
        if (!is_array($recomendaciones)) {
            $recomendaciones = [];
        }
        $recomendaciones = array_values(array_filter($recomendaciones, 'is_string'));
        // Prioriza las recomendaciones de suelo/nutrición, que son las que el
        // productor suele buscar, sin perder el resto si no hay coincidencias.
        $prioritarias = array_values(array_filter(
            $recomendaciones,
            static fn (string $texto): bool => preg_match('/fertil|nitr|ph|cal\b|nutr|suelo|dosis|encal/i', $texto) === 1,
        ));
        $seleccionadas = array_slice(array_values(array_unique(array_merge($prioritarias, $recomendaciones))), 0, 1);
        $recomendacionClave = $seleccionadas !== []
            ? mb_substr($seleccionadas[0], 0, 150, 'UTF-8')
            : null;

        return [
            'fecha' => $simulacion['fecha'] ?? null,
            'rendimiento_estimado' => $simulacion['rendimiento_estimado'] ?? null,
            'produccion_total' => $simulacion['produccion_total'] ?? null,
            'confianza' => $simulacion['confianza'] ?? null,
            'categoria_cosecha' => $simulacion['categoria_cosecha'] ?? null,
            'recomendacion_clave' => $recomendacionClave,
        ];
    }

    private function seguro(callable $fn): mixed
    {
        try {
            return $fn();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param array<string, mixed> $contexto
     * @param array<string, mixed> $precio
     * @return array<string, mixed>|null
     */
    private function calcularImpactoPrecio(array $contexto, array $precio): ?array
    {
        if (!($precio['disponible'] ?? false)) {
            return null;
        }

        $precioUsado = $contexto['finanzas']['kpis']['precio_maiz_qq'] ?? null;
        if (!is_numeric($precioUsado)) {
            return null;
        }

        $produccionQq = $contexto['finanzas']['kpis']['produccion_total_qq'] ?? null;
        if (!is_numeric($produccionQq)) {
            $produccionTon = $contexto['simulacion_reciente']['produccion_total'] ?? null;
            $produccionQq = is_numeric($produccionTon) ? (float) $produccionTon * 22.0462 : null;
        }
        if (!is_numeric($produccionQq)) {
            return null;
        }

        $deltaQq = round((float) $precio['promedio'] - (float) $precioUsado, 2);
        $produccionQq = round((float) $produccionQq, 1);
        $deltaIngreso = round($deltaQq * $produccionQq, 2);
        $formato = static fn (float $valor): string => number_format($valor, 2, '.', '');
        return [
            'precio_usado_en_finanzas_qq' => round((float) $precioUsado, 2),
            'precio_referencia_qq' => (float) $precio['promedio'],
            'delta_por_qq' => $deltaQq,
            'produccion_total_qq' => $produccionQq,
            'delta_ingreso_estimado' => $deltaIngreso,
            'lectura' => 'Con ' . number_format($produccionQq, 1, '.', '') . ' qq, la diferencia de '
                . $formato($deltaQq) . ' USD/qq equivale a ' . $formato($deltaIngreso)
                . ' USD estimados; no incluye costos ni calidad.',
            'nota' => 'Cálculo mecánico; no incluye cambios de costos ni calidad del grano.',
        ];
    }
}
