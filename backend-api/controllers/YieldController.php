<?php
// YieldController.php - Dashboard de rendimiento y brecha productiva. Compara rendimiento proyectado vs histórico.

require_once __DIR__ . '/../models/Simulacion.php';
require_once __DIR__ . '/../models/Cultivo.php';

class YieldController
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

        $selectedCultivo = null;
        if ($cultivoId) {
            $selectedCultivo = $this->cultivo->obtenerPorId($cultivoId);
        }

        $recientes = $this->simulacion->obtenerRecientes($usuarioId, 50, $year);

        if ($cultivoId) {
            $recientes = array_values(array_filter($recientes, fn($sim) => $sim['cultivo_id'] == $cultivoId));
        }

        $simCount = count($recientes);
        if ($simCount === 0) {
            echo json_encode([
                'sin_datos' => true,
                'sin_simulaciones' => true,
                'mensaje' => 'No hay simulaciones registradas para esta parcela.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $avgRend = 0; $avgTemp = 0; $avgFert = 0; $avgPh = 0; $avgPrec = 0;
        $rendimientos = [];

        if ($simCount > 0) {
            foreach ($recientes as $sim) {
                $r = floatval($sim['rendimiento_estimado'] ?? 0);
                $rendimientos[] = $r;
                $avgRend += $r;
                $avgTemp += floatval($sim['temperatura'] ?? 0);
                $avgFert += floatval($sim['fertilizante'] ?? 0);
                $avgPh   += floatval($sim['ph_suelo'] ?? 0);
                $avgPrec += floatval($sim['precipitacion'] ?? 0);
            }
            $avgRend = round($avgRend / $simCount, 2);
            $avgTemp = round($avgTemp / $simCount, 1);
            $avgFert = round($avgFert / $simCount, 0);
            $avgPh   = round($avgPh / $simCount, 1);
            $avgPrec = round($avgPrec / $simCount, 0);
        } else {
            $selectedCultivo = null;
            if ($cultivoId) {
                $selectedCultivo = $this->cultivo->obtenerPorId($cultivoId);
            }
            if (!$selectedCultivo) {
                $cultivos = $this->cultivo->obtenerPorUsuario($usuarioId);
                if (!empty($cultivos)) $selectedCultivo = $cultivos[0];
            }

            $avgRend = 6.25;
            $avgTemp = 24.5;
            $avgFert = 160;
            $avgPh   = floatval($selectedCultivo['ph'] ?? $selectedCultivo['ph_suelo'] ?? 6.2);
            $avgPrec = 950;
            $simCount = 1;
        }

        // Load agronomia data from JSON
        $jsonPath = __DIR__ . '/../data/agronomia_data.json';
        $agronomiaData = [];
        if (file_exists($jsonPath)) {
            $agronomiaData = json_decode(file_get_contents($jsonPath), true);
        }

        // Determinar variedad y zona
        $variedad_maiz = 'Pioneer P4039';
        $selectedCultivo = null;
        $isSierra = false;
        if ($cultivoId) {
            $selectedCultivo = $this->cultivo->obtenerPorId($cultivoId);
            if ($selectedCultivo) {
                $variedad_maiz = $selectedCultivo['variedad_maiz'] ?? 'Pioneer P4039';
                $alt = floatval($selectedCultivo['altitud'] ?? 45.0);
                $lng = floatval($selectedCultivo['longitud'] ?? -78.5);
                $isSierra = $alt > 1000 || ($lng > -79.0 && $lng < -78.0);
            }
        }

        // Buscar en variedades por zona
        $match_var = null;
        foreach (($agronomiaData['variedades_por_zona'] ?? []) as $v) {
            $name_excel = strtolower($v['Nombre / Código'] ?? '');
            $name_cultivo = strtolower($variedad_maiz);
            
            if (strpos($name_excel, $name_cultivo) !== false || strpos($name_cultivo, $name_excel) !== false) {
                $match_var = $v;
                break;
            }
        }

        if ($match_var) {
            $rendPotencial = floatval($match_var['Rendim. Máx. (t/ha)'] ?? 12.0);
            if ($rendPotencial <= 0) {
                $rendPotencial = floatval($match_var['Rendim. Promedio (t/ha)'] ?? 8.0) * 1.25;
            }
            $rendAlcanzable = floatval($match_var['Rendim. Promedio (t/ha)'] ?? 8.0);
        } else {
            $rendPotencial = $isSierra ? 7.0 : 12.0;
            $rendAlcanzable = $isSierra ? 5.5 : 9.7;
        }

        $rendPredicho = $avgRend > 0 ? $avgRend : $rendAlcanzable * 0.75;
        if ($rendPredicho >= $rendPotencial) {
            $rendPotencial = $rendPredicho * 1.15;
            $rendAlcanzable = $rendPredicho * 0.95;
        }
        $yieldGap = round($rendPotencial - $rendPredicho, 1);

        // Factores limitantes (basados en desviaciones óptimas de la zona)
        $optN = 180.0;
        $optPrec = $isSierra ? 1000.0 : 700.0;
        $optTemp = $isSierra ? 16.0 : 25.0;
        $optPh = 6.0;

        $defN = max(0, $optN - $avgFert);
        $defPrec = abs($optPrec - $avgPrec);
        $defTemp = abs($optTemp - $avgTemp);
        $defPh = abs($optPh - $avgPh);

        // Pérdidas proporcionales
        $perdidaNitrogeno = round($defN * 0.012, 1); 
        $perdidaAgua = round($defPrec * 0.002, 1);
        $perdidaTemp = round($defTemp * 0.15, 1);
        $perdidaFechaSiembra = round(max(0.1, mt_rand(2, 6) / 10), 1);
        $perdidaSuelo = round($defPh * 0.6, 1);

        $totalPerdidas = $perdidaNitrogeno + $perdidaAgua + $perdidaTemp + $perdidaFechaSiembra + $perdidaSuelo;
        if ($totalPerdidas <= 0) $totalPerdidas = 0.1;
        
        $factorAjuste = $yieldGap / $totalPerdidas;
        $perdidaNitrogeno = round($perdidaNitrogeno * $factorAjuste, 1);
        $perdidaAgua = round($perdidaAgua * $factorAjuste, 1);
        $perdidaTemp = round($perdidaTemp * $factorAjuste, 1);
        $perdidaFechaSiembra = round($perdidaFechaSiembra * $factorAjuste, 1);
        $perdidaSuelo = round($perdidaSuelo * $factorAjuste, 1);

        $factores = [
            'Nitrógeno' => $perdidaNitrogeno,
            'Agua' => $perdidaAgua,
            'Temperatura' => $perdidaTemp,
            'Fecha de Siembra' => $perdidaFechaSiembra,
            'Suelo (pH)' => $perdidaSuelo
        ];
        arsort($factores);
        $principalLimitante = array_key_first($factores);


        $mejorAnoHist = $simCount > 0 ? round(max($rendimientos) * 1.1, 1) : 10.5;
        $peorAnoHist = $simCount > 0 ? round(min($rendimientos) * 0.85, 1) : 3.2;

        // Proyección de ciclo fenológico (en semanas de cultivo)
        $semanasLabels = ['Sem 2', 'Sem 4', 'Sem 6', 'Sem 8 (Floración)', 'Sem 10', 'Sem 12', 'Sem 14 (Madurez)'];
        $rendActualProyectado = [];
        $rendMejorProyectado = [];
        $rendPeorProyectado = [];
        for ($i = 0; $i < 7; $i++) {
            $factor = sin(deg2rad(($i / 6) * 90));
            $rendActualProyectado[] = round($rendPredicho * $factor, 2);
            $rendMejorProyectado[] = round($mejorAnoHist * $factor, 2);
            $rendPeorProyectado[] = round($peorAnoHist * $factor, 2);
        }

        echo json_encode([
            'cultivo_activo' => $selectedCultivo,
            'kpis' => [
                'rendimiento_potencial' => $rendPotencial,
                'rendimiento_alcanzable' => $rendAlcanzable,
                'rendimiento_predicho' => $rendPredicho,
                'yield_gap_total' => $yieldGap,
                'principal_limitante' => $principalLimitante
            ],
            'waterfall_losses' => [
                ['name' => 'Potencial Teórico', 'value' => $rendPotencial, 'is_kpi' => true],
                ['name' => 'Pérdida Nitrógeno', 'value' => -$perdidaNitrogeno],
                ['name' => 'Pérdida Agua', 'value' => -$perdidaAgua],
                ['name' => 'Pérdida Temperatura', 'value' => -$perdidaTemp],
                ['name' => 'Pérdida Fecha Siembra', 'value' => -$perdidaFechaSiembra],
                ['name' => 'Pérdida Suelo (pH)', 'value' => -$perdidaSuelo],
                ['name' => 'Rendimiento Final Predicho', 'value' => $rendPredicho, 'is_kpi' => true]
            ],
            'fenologia_comparativa' => [
                'labels' => $semanasLabels,
                'proyeccion_actual' => $rendActualProyectado,
                'mejor_ano' => $rendMejorProyectado,
                'peor_ano' => $rendPeorProyectado
            ],
            'factores_contribucion' => [
                ['factor' => 'Nitrógeno', 'porcentaje' => round(($perdidaNitrogeno / $yieldGap) * 100, 1)],
                ['factor' => 'Agua', 'porcentaje' => round(($perdidaAgua / $yieldGap) * 100, 1)],
                ['factor' => 'Temperatura', 'porcentaje' => round(($perdidaTemp / $yieldGap) * 100, 1)],
                ['factor' => 'Fecha de Siembra', 'porcentaje' => round(($perdidaFechaSiembra / $yieldGap) * 100, 1)],
                ['factor' => 'Suelo (pH)', 'porcentaje' => round(($perdidaSuelo / $yieldGap) * 100, 1)]
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
