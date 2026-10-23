<?php
// src/Dominios/Analitica/Aplicacion/ServicioAnaliticaFinancial.php — Servicio que construye los datos del dashboard Financial.
// Port verbatim de FinancialController::index() (líneas 28-219), adaptado a return array.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;

class ServicioAnaliticaFinancial
{
    public function __construct(
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId, ?int $anio, Peticion $p): array
    {
        $parametrosFinancieros = ['precio_maiz_qq', 'rendimiento_qq', 'precio_maiz', 'costo_semilla', 'costo_fert', 'costo_riego', 'costo_proteccion', 'otros_var', 'costos_variables', 'costos_fijos'];
        foreach ($parametrosFinancieros as $parametro) {
            $valor = $p->query($parametro);
            if ($valor !== null && $valor !== '' && (!is_numeric($valor) || !is_finite((float) $valor) || (float) $valor < 0)) {
                throw new ValidacionException("El parámetro {$parametro} debe ser un número no negativo.");
            }
        }

        $recientes = $this->simulaciones->obtenerRecientes($usuarioId, 50, $anio);

        $selectedCultivo = null;
        if ($cultivoId) {
            $selectedCultivo = $this->cultivos->obtenerPorId($cultivoId);
            if (!$selectedCultivo || (int) $selectedCultivo['usuario_id'] !== $usuarioId) {
                throw new AccesoDenegadoException('Esta parcela no es válida o no está registrada a tu nombre.');
            }
            $recientes = array_values(array_filter($recientes, fn($sim) => $sim['cultivo_id'] == $cultivoId));
        }

        $simCount = count($recientes);
        $avgRend = 0; $avgFert = 0;
        $rendimientos = [];

        $hasCustomOverrides = false;
        foreach ($parametrosFinancieros as $parametro) {
            if ($p->query($parametro) !== null && $p->query($parametro) !== '') {
                $hasCustomOverrides = true;
                break;
            }
        }

        if ($simCount === 0 && !$hasCustomOverrides) {
            return [
                'sin_datos' => true,
                'sin_simulaciones' => true,
                'mensaje' => 'No hay simulaciones registradas para esta parcela en este año.'
            ];
        }

        if ($simCount > 0) {
            foreach ($recientes as $sim) {
                $r = floatval($sim['rendimiento_estimado'] ?? 0);
                $rendimientos[] = $r;
                $avgRend += $r;
                $avgFert += floatval($sim['fertilizante'] ?? 0);
            }
            $avgRend = round($avgRend / $simCount, 2);
            $avgFert = round($avgFert / $simCount, 0);
        } else {
            $avgRend = 6.25;
            $avgFert = 160;
            $simCount = 1;
        }

        if (!$selectedCultivo) {
            $cultivos = $this->cultivos->obtenerPorUsuario($usuarioId);
            if (!empty($cultivos)) $selectedCultivo = $cultivos[0];
        }
        $areaParcela = max(0.1, floatval($selectedCultivo['area'] ?? 1.0));
        $nombreParcela = $selectedCultivo['nombre_parcela'] ?? 'Lote Principal';

        $simAvgRend = $avgRend;
        $simAvgFert = round($avgFert * 0.8, 0);
        $simRendQq = round($simAvgRend * 22.0462, 1);

        $precioQq = $p->query('precio_maiz_qq') !== null && $p->query('precio_maiz_qq') !== ''
            ? max(0, floatval($p->query('precio_maiz_qq')))
            : ($p->query('precio_maiz') !== null && $p->query('precio_maiz') !== '' ? max(0, floatval($p->query('precio_maiz')) / 22.0462) : 16.50);

        $rendimientoQq = $p->query('rendimiento_qq') !== null && $p->query('rendimiento_qq') !== ''
            ? max(0, floatval($p->query('rendimiento_qq')))
            : ($simRendQq > 0 ? $simRendQq : 110.0);

        $avgRend = round($rendimientoQq / 22.0462, 3);
        $precioMaiz = round($precioQq * 22.0462, 2);

        $costoSemilla = $p->query('costo_semilla') !== null && $p->query('costo_semilla') !== '' ? max(0, floatval($p->query('costo_semilla'))) : 85;
        $costoFertilizacion = $p->query('costo_fert') !== null && $p->query('costo_fert') !== '' ? max(0, floatval($p->query('costo_fert'))) : ($simAvgFert > 0 ? $simAvgFert : 120);
        $costoRiego = $p->query('costo_riego') !== null && $p->query('costo_riego') !== '' ? max(0, floatval($p->query('costo_riego'))) : 60;
        $costoProteccion = $p->query('costo_proteccion') !== null && $p->query('costo_proteccion') !== '' ? max(0, floatval($p->query('costo_proteccion'))) : 45;
        $costosVariables = $p->query('otros_var') !== null && $p->query('otros_var') !== ''
            ? max(0, floatval($p->query('otros_var')))
            : ($p->query('costos_variables') !== null && $p->query('costos_variables') !== '' ? max(0, floatval($p->query('costos_variables'))) : 80);
        $costosFijos = $p->query('costos_fijos') !== null && $p->query('costos_fijos') !== '' ? max(0, floatval($p->query('costos_fijos'))) : 120;

        $costoTotal = $costoSemilla + $costoFertilizacion + $costoRiego + $costoProteccion + $costosFijos + $costosVariables;
        $ingresoBruto = round($avgRend * $precioMaiz, 2);
        $margenBruto = round($ingresoBruto - ($costoSemilla + $costoFertilizacion + $costoRiego + $costoProteccion + $costosVariables), 2);
        $margenNeto = round($ingresoBruto - $costoTotal, 2);
        $breakEven = $costoTotal > 0 && $precioMaiz > 0 ? round($costoTotal / $precioMaiz, 2) : 0;
        $precioPisoQq = ($avgRend * 22.0462) > 0 ? round($costoTotal / ($avgRend * 22.0462), 2) : 0;

        $ingresoBrutoParcela = round($ingresoBruto * $areaParcela, 2);
        $costoTotalParcela = round($costoTotal * $areaParcela, 2);
        $margenNetoParcela = round($margenNeto * $areaParcela, 2);
        $produccionTotalQq = round($rendimientoQq * $areaParcela, 1);

        // No presentar una probabilidad fija como si proviniera del modelo.
        // Con al menos cinco simulaciones del lote, se muestra la frecuencia
        // empírica de escenarios cuyo ingreso cubre el costo configurado.
        $probBreakEven = null;
        $rendimientosValidos = array_values(array_filter($rendimientos, static fn (float $rendimiento): bool => $rendimiento > 0));
        if (count($rendimientosValidos) >= 5 && $precioQq > 0) {
            $escenariosRentables = count(array_filter(
                $rendimientosValidos,
                static fn (float $rendimiento): bool => ($rendimiento * 22.0462 * $precioQq) >= $costoTotal,
            ));
            $probBreakEven = round(100 * $escenariosRentables / count($rendimientosValidos), 1);
        }
        $roiEsperado = $costoTotal > 0 ? round(($margenNeto / $costoTotal) * 100, 1) : 0;
        $gananciaPorDolar = $costoTotal > 0 ? round($margenNeto / $costoTotal, 2) : 0;

        $factoresSensibilidad = [0.75, 0.9, 1.0, 1.1, 1.25];
        $preciosRange = array_map(static fn (float $factor): float => round($precioQq * $factor, 2), $factoresSensibilidad);
        $rendRange = array_map(static fn (float $factor): float => round($rendimientoQq * $factor, 1), $factoresSensibilidad);

        $sensibilidadData = [];
        foreach ($preciosRange as $p) {
            foreach ($rendRange as $r) {
                $ingresoPorHa = $r * $p;
                $net = round($ingresoPorHa - $costoTotal, 2);
                $sensibilidadData[] = ['precio' => $p,'rendimiento' => $r,'margen' => $net];
            }
        }

        $estrategiasHipoteticas = [
            ['nombre' => 'Escenario base', 'factor_ingreso' => 1.0, 'costo_ajuste' => 0.0, 'factor_rendimiento' => 1.0],
            ['nombre' => 'Supuesto: 40% menos costo de fertilización', 'factor_ingreso' => 1.0, 'costo_ajuste' => -$costoFertilizacion * 0.4, 'factor_rendimiento' => 1.0],
            ['nombre' => 'Supuesto: 15% más producción y USD 40 más de costo', 'factor_ingreso' => 1.15, 'costo_ajuste' => 40.0, 'factor_rendimiento' => 1.15],
            ['nombre' => 'Supuesto: 6% más producción y USD 25 más de costo', 'factor_ingreso' => 1.06, 'costo_ajuste' => 25.0, 'factor_rendimiento' => 1.06],
        ];
        $roiEstrategias = array_map(static function (array $estrategia) use ($ingresoBruto, $costoTotal, $avgRend): array {
            $ingreso = $ingresoBruto * $estrategia['factor_ingreso'];
            $costo = max(0.0, $costoTotal + $estrategia['costo_ajuste']);
            $margen = $ingreso - $costo;
            return [
                'nombre' => $estrategia['nombre'],
                'roi' => $costo > 0 ? round(100 * $margen / $costo, 1) : null,
                'costo' => round($costo, 2),
                'margen' => round($margen, 2),
                'rendimiento' => round($avgRend * $estrategia['factor_rendimiento'], 2),
            ];
        }, $estrategiasHipoteticas);

        $waterfallCosts = [
            ['label' => 'Ingreso Bruto','amount' => $ingresoBruto,'is_total' => true],
            ['label' => 'Semilla','amount' => -$costoSemilla],
            ['label' => 'Fertilización','amount' => -$costoFertilizacion],
            ['label' => 'Riego / Manejo','amount' => -$costoRiego],
            ['label' => 'Protección Plagas','amount' => -$costoProteccion],
            ['label' => 'Otros Costos Var.','amount' => -$costosVariables],
            ['label' => 'Costos Fijos','amount' => -$costosFijos],
            ['label' => 'Margen Neto','amount' => $margenNeto,'is_total' => true]
        ];

        return [
            'datos_base_sistema' => [
                'precio_maiz_qq' => round($precioQq, 2),
                'rendimiento_qq' => $rendimientoQq,
                'costo_semilla'  => $costoSemilla,
                'costo_fert'     => $costoFertilizacion,
                'costo_riego'    => $costoRiego,
                'costo_proteccion' => $costoProteccion,
                'otros_var'      => $costosVariables,
                'costos_fijos'    => $costosFijos,
                'area_parcela'   => $areaParcela,
                'nombre_parcela' => $nombreParcela,
                'rendimiento_tha' => $avgRend
            ],
            'kpis' => [
                'margen_neto' => $margenNeto,
                'margen_bruto' => $margenBruto,
                'punto_equilibrio' => $breakEven,
                'prob_superar_break_even' => $probBreakEven,
                'roi' => $roiEsperado,
                'precio_maiz' => $precioMaiz,
                'precio_maiz_qq' => round($precioQq, 2),
                'precio_piso_qq' => $precioPisoQq,
                'ganancia_por_dolar' => $gananciaPorDolar,
                'area_parcela' => $areaParcela,
                'nombre_parcela' => $nombreParcela,
                'ingreso_bruto_parcela' => $ingresoBrutoParcela,
                'costo_total_parcela' => $costoTotalParcela,
                'margen_neto_parcela' => $margenNetoParcela,
                'produccion_total_qq' => $produccionTotalQq
            ],
            'costo_total' => $costoTotal,
            'sensibilidad' => $sensibilidadData,
            'precios_rango' => $preciosRange,
            'rendimientos_rango' => $rendRange,
            'roi_estrategias' => $roiEstrategias,
            'waterfall_costos' => $waterfallCosts
        ];
    }
}
