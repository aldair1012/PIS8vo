<?php
// FinancialController.php - Dashboard financiero. Calcula costos de insumos, ingresos brutos y estimaciones de ROI.

require_once __DIR__ . '/../models/Simulacion.php';
require_once __DIR__ . '/../models/Cultivo.php';

class FinancialController
{
    private Simulacion $simulacion;
    private Cultivo $cultivo;

    public function __construct()
    {
        $this->simulacion = new Simulacion();
        $this->cultivo = new Cultivo();
    }

    private function getAuthUserOrError()
    {
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        return $_SESSION['usuario_id'];
    }

    public function index(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $year = isset($_GET['anio']) && $_GET['anio'] !== '' ? intval($_GET['anio']) : null;
        $cultivoId = isset($_GET['cultivo_id']) && $_GET['cultivo_id'] !== '' ? intval($_GET['cultivo_id']) : null;

        $recientes = $this->simulacion->obtenerRecientes($usuarioId, 50, $year);

        if ($cultivoId) {
            $recientes = array_values(array_filter($recientes, fn($sim) => $sim['cultivo_id'] == $cultivoId));
        }

        $simCount = count($recientes);
        $avgRend = 0; $avgFert = 0;
        $rendimientos = [];

        $hasCustomOverrides = isset($_GET['precio_maiz_qq']) || isset($_GET['rendimiento_qq']) || isset($_GET['costo_semilla']) || isset($_GET['costo_fert']);

        if ($simCount === 0 && !$hasCustomOverrides) {
            echo json_encode([
                'sin_datos' => true,
                'sin_simulaciones' => true,
                'mensaje' => 'No hay simulaciones registradas para esta parcela en este año.'
            ], JSON_UNESCAPED_UNICODE);
            return;
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
            $selectedCultivo = $this->cultivo->obtenerPorId($cultivoId);
        }
        if (!$selectedCultivo) {
            $cultivos = $this->cultivo->obtenerPorUsuario($usuarioId);
            if (!empty($cultivos)) $selectedCultivo = $cultivos[0];
        }
        $areaParcela = max(0.1, floatval($selectedCultivo['area'] ?? 1.0));
        $nombreParcela = $selectedCultivo['nombre_parcela'] ?? 'Lote Principal';

        // Obtener datos calculados previamente o de los parámetros GET sanitizados (sin valores negativos)
        $simAvgRend = $avgRend;
        $simAvgFert = round($avgFert * 0.8, 0);
        $simRendQq = round($simAvgRend * 22.0462, 1);

        $precioQq = isset($_GET['precio_maiz_qq']) && $_GET['precio_maiz_qq'] !== '' 
            ? max(0, floatval($_GET['precio_maiz_qq'])) 
            : (isset($_GET['precio_maiz']) && $_GET['precio_maiz'] !== '' ? max(0, floatval($_GET['precio_maiz']) / 22.0462) : 16.50);
        
        $rendimientoQq = isset($_GET['rendimiento_qq']) && $_GET['rendimiento_qq'] !== '' 
            ? max(0, floatval($_GET['rendimiento_qq'])) 
            : ($simRendQq > 0 ? $simRendQq : 110.0);

        $avgRend = round($rendimientoQq / 22.0462, 3);
        $precioMaiz = round($precioQq * 22.0462, 2);

        $costoSemilla = isset($_GET['costo_semilla']) && $_GET['costo_semilla'] !== '' ? max(0, floatval($_GET['costo_semilla'])) : 85;
        $costoFertilizacion = isset($_GET['costo_fert']) && $_GET['costo_fert'] !== '' ? max(0, floatval($_GET['costo_fert'])) : ($simAvgFert > 0 ? $simAvgFert : 120);
        $costoRiego = isset($_GET['costo_riego']) && $_GET['costo_riego'] !== '' ? max(0, floatval($_GET['costo_riego'])) : 60;
        $costoProteccion = isset($_GET['costo_proteccion']) && $_GET['costo_proteccion'] !== '' ? max(0, floatval($_GET['costo_proteccion'])) : 45;
        $costosVariables = isset($_GET['otros_var']) && $_GET['otros_var'] !== '' 
            ? max(0, floatval($_GET['otros_var'])) 
            : (isset($_GET['costos_variables']) && $_GET['costos_variables'] !== '' ? max(0, floatval($_GET['costos_variables'])) : 80);
        $costosFijos = isset($_GET['costos_fijos']) && $_GET['costos_fijos'] !== '' ? max(0, floatval($_GET['costos_fijos'])) : 120;

        $costoTotal = $costoSemilla + $costoFertilizacion + $costoRiego + $costoProteccion + $costosFijos + $costosVariables;
        $ingresoBruto = round($avgRend * $precioMaiz, 2);
        $margenBruto = round($ingresoBruto - ($costoSemilla + $costoFertilizacion + $costoRiego + $costoProteccion + $costosVariables), 2);
        $margenNeto = round($ingresoBruto - $costoTotal, 2);
        $breakEven = $costoTotal > 0 && $precioMaiz > 0 ? round($costoTotal / $precioMaiz, 2) : 0;
        $precioPisoQq = ($avgRend * 22.0462) > 0 ? round($costoTotal / ($avgRend * 22.0462), 2) : 0;

        // Cálculos consolidados para toda la superficie de la parcela
        $ingresoBrutoParcela = round($ingresoBruto * $areaParcela, 2);
        $costoTotalParcela = round($costoTotal * $areaParcela, 2);
        $margenNetoParcela = round($margenNeto * $areaParcela, 2);
        $produccionTotalQq = round($rendimientoQq * $areaParcela, 1);

        $probBreakEven = 88.0;
        $roiEsperado = $costoTotal > 0 ? round(($margenNeto / $costoTotal) * 100, 1) : 0;
        $gananciaPorDolar = $costoTotal > 0 ? round($margenNeto / $costoTotal, 2) : 0;

        // Sensibilidad y rangos (Precio $/qq vs Rendimiento qq/ha)
        $preciosRange = [12.0, 14.5, 16.5, 18.5, 21.0];
        $rendRange = [70, 90, 110, 130, 150];

        $sensibilidadData = [];
        foreach ($preciosRange as $p) {
            foreach ($rendRange as $r) {
                $ingresoPorHa = $r * $p;
                $net = round($ingresoPorHa - $costoTotal, 2);
                $sensibilidadData[] = [
                    'precio' => $p,
                    'rendimiento' => $r,
                    'margen' => $net
                ];
            }
        }

        $roiEstrategias = [
            [
                'nombre' => 'Manejo Convencional (Base)',
                'roi' => $roiEsperado,
                'margen' => $margenNeto,
                'rendimiento' => round($avgRend, 2)
            ],
            [
                'nombre' => 'Biofertilizante INIAP (Ahorro 40% Fert.)',
                'roi' => round((($ingresoBruto - ($costoTotal - ($costoFertilizacion * 0.4))) / ($costoTotal - ($costoFertilizacion * 0.4))) * 100, 1),
                'margen' => round($margenNeto + ($costoFertilizacion * 0.4), 2),
                'rendimiento' => round($avgRend, 2)
            ],
            [
                'nombre' => 'Fertirriego por Goteo (Alta Precisión)',
                'roi' => round((($ingresoBruto * 1.15 - ($costoTotal + 40)) / ($costoTotal + 40)) * 100, 1),
                'margen' => round(($ingresoBruto * 1.15) - ($costoTotal + 40), 2),
                'rendimiento' => round($avgRend * 1.15, 2)
            ],
            [
                'nombre' => 'Materia Orgánica (Compost/Enmienda)',
                'roi' => round((($ingresoBruto * 1.06 - ($costoTotal + 25)) / ($costoTotal + 25)) * 100, 1),
                'margen' => round(($ingresoBruto * 1.06) - ($costoTotal + 25), 2),
                'rendimiento' => round($avgRend * 1.06, 2)
            ]
        ];

        $waterfallCosts = [
            ['label' => 'Ingreso Bruto', 'amount' => $ingresoBruto, 'is_total' => true],
            ['label' => 'Semilla', 'amount' => -$costoSemilla],
            ['label' => 'Fertilización', 'amount' => -$costoFertilizacion],
            ['label' => 'Riego / Manejo', 'amount' => -$costoRiego],
            ['label' => 'Protección Plagas', 'amount' => -$costoProteccion],
            ['label' => 'Otros Costos Var.', 'amount' => -$costosVariables],
            ['label' => 'Costos Fijos', 'amount' => -$costosFijos],
            ['label' => 'Margen Neto', 'amount' => $margenNeto, 'is_total' => true]
        ];

        echo json_encode([
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
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
