<?php
// src/Dominios/Analitica/Aplicacion/ServicioAnaliticaFinancial.php — Servicio que construye los datos del dashboard Financial.
// Port verbatim de FinancialController::index() (líneas 28-219), adaptado a return array.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Kernel\Peticion;

class ServicioAnaliticaFinancial
{
    public function __construct(
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId, ?int $anio, Peticion $p): array
    {
        $recientes = $this->simulaciones->obtenerRecientes($usuarioId, 50, $anio);

        if ($cultivoId) {
            $recientes = array_values(array_filter($recientes, fn($sim) => $sim['cultivo_id'] == $cultivoId));
        }

        $simCount = count($recientes);
        $avgRend = 0; $avgFert = 0;
        $rendimientos = [];

        $hasCustomOverrides = $p->query('precio_maiz_qq') !== null || $p->query('rendimiento_qq') !== null
            || $p->query('costo_semilla') !== null || $p->query('costo_fert') !== null;

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

        $selectedCultivo = null;
        if ($cultivoId) {
            $selectedCultivo = $this->cultivos->obtenerPorId($cultivoId);
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

        $probBreakEven = 88.0;
        $roiEsperado = $costoTotal > 0 ? round(($margenNeto / $costoTotal) * 100, 1) : 0;
        $gananciaPorDolar = $costoTotal > 0 ? round($margenNeto / $costoTotal, 2) : 0;

        $preciosRange = [12.0, 14.5, 16.5, 18.5, 21.0];
        $rendRange = [70, 90, 110, 130, 150];

        $sensibilidadData = [];
        foreach ($preciosRange as $p) {
            foreach ($rendRange as $r) {
                $ingresoPorHa = $r * $p;
                $net = round($ingresoPorHa - $costoTotal, 2);
                $sensibilidadData[] = ['precio' => $p,'rendimiento' => $r,'margen' => $net];
            }
        }

        $roiEstrategias = [
            ['nombre' => 'Manejo Convencional (Base)','roi' => $roiEsperado,'margen' => $margenNeto,'rendimiento' => round($avgRend, 2)],
            ['nombre' => 'Biofertilizante INIAP (Ahorro 40% Fert.)','roi' => round((($ingresoBruto - ($costoTotal - ($costoFertilizacion * 0.4))) / ($costoTotal - ($costoFertilizacion * 0.4))) * 100, 1),'margen' => round($margenNeto + ($costoFertilizacion * 0.4), 2),'rendimiento' => round($avgRend, 2)],
            ['nombre' => 'Fertirriego por Goteo (Alta Precisión)','roi' => round((($ingresoBruto * 1.15 - ($costoTotal + 40)) / ($costoTotal + 40)) * 100, 1),'margen' => round(($ingresoBruto * 1.15) - ($costoTotal + 40), 2),'rendimiento' => round($avgRend * 1.15, 2)],
            ['nombre' => 'Materia Orgánica (Compost/Enmienda)','roi' => round((($ingresoBruto * 1.06 - ($costoTotal + 25)) / ($costoTotal + 25)) * 100, 1),'margen' => round(($ingresoBruto * 1.06) - ($costoTotal + 25), 2),'rendimiento' => round($avgRend * 1.06, 2)]
        ];

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