<?php
// Escenarios financieros explícitos: costos/precios son supuestos, no gastos observados.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;

class ServicioAnaliticaFinancial
{
    private const QQ_POR_TONELADA = 22.0462;

    public function __construct(
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId, ?int $año, Peticion $p): array
    {
        $parametros = [];
        foreach (['precio_maiz_qq', 'rendimiento_qq', 'precio_maiz', 'costo_semilla', 'costo_fert', 'costo_riego', 'costo_proteccion', 'otros_var', 'costos_variables', 'costos_fijos'] as $campo) {
            $valor = $p->query($campo);
            if ($valor === null || $valor === '') continue;
            $numero = $this->numero($valor);
            if ($numero === null || $numero < 0) throw new ValidacionException("El parámetro {$campo} debe ser un número finito no negativo.");
            $parametros[$campo] = $numero;
        }

        $cultivo = null;
        if ($cultivoId !== null) {
            $cultivo = $this->cultivos->obtenerPorId($cultivoId);
            if (!$cultivo || (int) ($cultivo['usuario_id'] ?? 0) !== $usuarioId) {
                throw new AccesoDenegadoException('Esta parcela no es válida o no está registrada a tu nombre.');
            }
        }
        $recientes = $cultivoId !== null
            ? $this->simulaciones->obtenerRecientesPorCultivo($usuarioId, $cultivoId, 50, $año)
            : $this->simulaciones->obtenerRecientes($usuarioId, 50, $año);
        $rendimientos = [];
        foreach ($recientes as $fila) {
            $r = $this->numero($fila['rendimiento_estimado'] ?? null);
            if ($r !== null && $r >= 0) $rendimientos[] = $r;
        }
        $n = count($rendimientos);
        if ($n === 0 && $parametros === []) {
            return ['sin_datos' => true, 'sin_simulaciones' => true,
                'mensaje' => 'No hay simulaciones con rendimiento válido para esta parcela y año. Puedes configurar un escenario hipotético explícito.'];
        }
        $media = $n > 0 ? array_sum(array_map(static fn (float $r): float => $r / $n, $rendimientos)) : null;
        $area = $this->numero($cultivo['area'] ?? null);
        $area = $area !== null && $area > 0 ? $area : null;
        $nombreParcela = $cultivo['nombre_parcela'] ?? 'Sin parcela seleccionada';
        $fuentes = [];
        if (array_key_exists('precio_maiz_qq', $parametros)) {
            $precioQq = $parametros['precio_maiz_qq'];
            $fuentes['precio_maiz_qq'] = 'supuesto_ingresado_usuario';
        } elseif (array_key_exists('precio_maiz', $parametros)) {
            $precioQq = $parametros['precio_maiz'] / self::QQ_POR_TONELADA;
            $fuentes['precio_maiz_qq'] = 'precio_por_tonelada_ingresado_convertido_a_qq';
        } else {
            $precioQq = 16.50;
            $fuentes['precio_maiz_qq'] = 'supuesto_configurable_sin_cotizacion_mercado';
        }
        $rendimientoQq = $parametros['rendimiento_qq'] ?? ($media !== null ? $this->resultado($media * self::QQ_POR_TONELADA) : null);
        $fuentes['rendimiento_qq'] = array_key_exists('rendimiento_qq', $parametros)
            ? 'supuesto_ingresado_usuario' : ($media !== null ? 'media_rendimientos_modelo_guardados' : 'no_disponible');
        $avgRend = $rendimientoQq !== null ? $rendimientoQq / self::QQ_POR_TONELADA : null;
        $precioMaizCalculo = $this->resultado($precioQq * self::QQ_POR_TONELADA);
        $precioMaiz = $precioMaizCalculo !== null ? $this->resultado($precioMaizCalculo, 2) : null;

        // Estos valores son editables para explorar un presupuesto; no provienen
        // de comprobantes ni de multiplicar kilogramos de N por dólares supuestos.
        $costos = [];
        foreach (['costo_semilla' => 85.0, 'costo_fert' => 120.0, 'costo_riego' => 60.0, 'costo_proteccion' => 45.0, 'otros_var' => 80.0, 'costos_fijos' => 120.0] as $campo => $default) {
            $alias = $campo === 'otros_var' && !array_key_exists($campo, $parametros) ? 'costos_variables' : $campo;
            $costos[$campo] = $parametros[$alias] ?? $default;
            $fuentes[$campo] = array_key_exists($alias, $parametros) ? 'supuesto_ingresado_usuario' : 'supuesto_configurable_sin_costo_observado';
        }
        $costoTotal = array_sum($costos);
        if (!is_finite($costoTotal)) throw new ValidacionException('La suma de costos supera la capacidad numérica del cálculo.');
        $ingresoBruto = $rendimientoQq !== null ? $this->resultado($rendimientoQq * $precioQq, 2) : null;
        $margenBruto = $ingresoBruto !== null ? $this->resultado($ingresoBruto - ($costoTotal - $costos['costos_fijos']), 2) : null;
        $margenNeto = $ingresoBruto !== null ? $this->resultado($ingresoBruto - $costoTotal, 2) : null;
        $breakEven = $precioMaizCalculo !== null && $precioMaizCalculo > 0 ? $this->resultado($costoTotal / $precioMaizCalculo, 3) : null;
        $precioPisoQq = $rendimientoQq !== null && $rendimientoQq > 0 ? $this->resultado($costoTotal / $rendimientoQq, 2) : null;
        $roi = $margenNeto !== null && $costoTotal > 0 ? $this->resultado(100 * ($margenNeto / $costoTotal), 1) : null;
        $gananciaPorDolar = $margenNeto !== null && $costoTotal > 0 ? $this->resultado($margenNeto / $costoTotal, 2) : null;

        $fraccionCubreCostos = null;
        if ($n >= 5) {
            $rentables = count(array_filter($rendimientos, static function (float $r) use ($precioQq, $costoTotal): bool {
                if ($precioQq === 0.0) return $costoTotal === 0.0;
                // Comparar con el umbral evita desbordar al multiplicar grandes ingresos.
                return $r >= ($costoTotal / $precioQq) / self::QQ_POR_TONELADA;
            }));
            $fraccionCubreCostos = round($rentables * 100 / $n, 1);
        }
        $factores = [0.75, 0.9, 1.0, 1.1, 1.25];
        $precios = $this->rango($precioQq, $factores, 2);
        $rindes = $rendimientoQq !== null ? $this->rango($rendimientoQq, $factores, 1) : [];
        $sensibilidad = [];
        foreach ($precios as $precio) {
            foreach ($rindes as $rinde) {
                $ingreso = $this->resultado($rinde * $precio);
                $sensibilidad[] = ['precio' => $precio, 'rendimiento' => $rinde,
                    'margen' => $ingreso !== null ? $this->resultado($ingreso - $costoTotal, 2) : null,
                    'tipo' => 'escenario_hipotetico'];
            }
        }
        $estrategias = [
            ['nombre' => 'Escenario base', 'factor' => 1.0, 'ajuste' => 0.0],
            ['nombre' => 'Supuesto: 40% menos costo de fertilización', 'factor' => 1.0, 'ajuste' => -$costos['costo_fert'] * 0.4],
            ['nombre' => 'Supuesto: 15% más producción y USD 40 más de costo', 'factor' => 1.15, 'ajuste' => 40.0],
            ['nombre' => 'Supuesto: 6% más producción y USD 25 más de costo', 'factor' => 1.06, 'ajuste' => 25.0],
        ];
        $roiEstrategias = [];
        foreach ($estrategias as $estrategia) {
            $ingreso = $ingresoBruto !== null ? $this->resultado($ingresoBruto * $estrategia['factor']) : null;
            $costo = $this->resultado(max(0.0, $costoTotal + $estrategia['ajuste']), 2);
            $margen = $ingreso !== null && $costo !== null ? $this->resultado($ingreso - $costo, 2) : null;
            $roiEstrategias[] = ['nombre' => $estrategia['nombre'], 'tipo' => 'escenario_hipotetico',
                'roi' => $margen !== null && $costo > 0 ? $this->resultado(100 * ($margen / $costo), 1) : null,
                'costo' => $costo, 'margen' => $margen,
                'rendimiento' => $avgRend !== null ? $this->resultado($avgRend * $estrategia['factor'], 3) : null];
        }
        $waterfall = [['label' => 'Ingreso Bruto', 'amount' => $ingresoBruto, 'is_total' => true]];
        foreach (['costo_semilla' => 'Semilla', 'costo_fert' => 'Fertilización', 'costo_riego' => 'Riego / Manejo', 'costo_proteccion' => 'Protección Plagas', 'otros_var' => 'Otros Costos Var.', 'costos_fijos' => 'Costos Fijos'] as $campo => $label) {
            $waterfall[] = ['label' => $label, 'amount' => -$costos[$campo]];
        }
        $waterfall[] = ['label' => 'Margen Neto', 'amount' => $margenNeto, 'is_total' => true];

        return [
            'datos_base_sistema' => [
                'precio_maiz_qq' => $precioQq, 'rendimiento_qq' => $rendimientoQq !== null ? round($rendimientoQq, 3) : null,
                ...$costos, 'area_parcela' => $area, 'nombre_parcela' => $nombreParcela,
                'rendimiento_tha' => $avgRend !== null ? round($avgRend, 3) : null,
            ],
            'kpis' => [
                'ingreso_bruto' => $ingresoBruto, 'margen_neto' => $margenNeto, 'margen_bruto' => $margenBruto,
                'punto_equilibrio' => $breakEven, 'prob_superar_break_even' => null,
                'roi' => $roi, 'precio_maiz' => $precioMaiz, 'precio_maiz_qq' => $precioQq,
                'precio_piso_qq' => $precioPisoQq, 'ganancia_por_dolar' => $gananciaPorDolar,
                'area_parcela' => $area, 'nombre_parcela' => $nombreParcela,
                'ingreso_bruto_parcela' => $area !== null && $ingresoBruto !== null ? $this->resultado($ingresoBruto * $area, 2) : null,
                'costo_total_parcela' => $area !== null ? $this->resultado($costoTotal * $area, 2) : null,
                'margen_neto_parcela' => $area !== null && $margenNeto !== null ? $this->resultado($margenNeto * $area, 2) : null,
                'produccion_total_qq' => $area !== null && $rendimientoQq !== null ? $this->resultado($rendimientoQq * $area, 3) : null,
            ],
            'costo_total' => $costoTotal, 'sensibilidad' => $sensibilidad,
            'precios_rango' => $precios, 'rendimientos_rango' => $rindes,
            'roi_estrategias' => $roiEstrategias, 'waterfall_costos' => $waterfall,
            'resumen_descriptivo' => ['muestra' => $n, 'fraccion_cubre_costos_pct' => $fraccionCubreCostos,
                'nota' => 'Fracción de al menos cinco simulaciones guardadas bajo el precio y costos supuestos; no es una probabilidad calibrada ni cosechas observadas. Incluye rendimientos cero.'],
            'supuestos' => [
                'tipo' => 'escenario_financiero_hipotetico', 'fuentes' => $fuentes,
                'area_fuente' => $area !== null ? 'registro_parcela_seleccionada' : 'no_disponible',
                'conversion_qq_por_tonelada' => self::QQ_POR_TONELADA,
                'unidad_costos' => 'USD/ha', 'unidad_precio' => 'USD/qq', 'unidad_rendimiento' => 'qq/ha',
                'nota' => 'Los costos y precios son supuestos configurables, no facturas ni una cotización de mercado. Los kilogramos de nitrógeno no determinan dólares. Los cambios de estrategia no aseguran respuestas agronómicas. Un resultado null no puede calcularse con los datos disponibles o excede la representación numérica.',
            ],
        ];
    }

    private function numero(mixed $valor): ?float
    {
        if (is_bool($valor) || !is_numeric($valor)) return null;
        $n = (float) $valor;
        return is_finite($n) ? $n : null;
    }

    private function resultado(float $valor, ?int $decimales = null): ?float
    {
        if (!is_finite($valor)) return null;
        $r = $decimales !== null ? round($valor, $decimales) : $valor;
        return is_finite($r) ? $r : null;
    }

    private function rango(float $base, array $factores, int $decimales): array
    {
        $valores = [];
        foreach ($factores as $factor) {
            $valor = $this->resultado($base * $factor, $decimales);
            if ($valor !== null && !in_array($valor, $valores, true)) $valores[] = $valor;
        }
        return $valores;
    }
}
