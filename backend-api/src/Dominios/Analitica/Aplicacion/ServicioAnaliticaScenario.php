<?php
// src/Dominios/Analitica/Aplicacion/ServicioAnaliticaScenario.php — Servicio que construye los datos del dashboard Scenario.
// Port verbatim de ScenarioController::index() (líneas 28-675), adaptado a return array.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;

class ServicioAnaliticaScenario
{
    public function __construct(
        private CatalogoAgronomicoInterface $catalogo,
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId = null, ?int $anio = null): array
    {
        $estadisticas = $this->simulaciones->obtenerEstadisticas($usuarioId, $anio);
        $recientes = $this->simulaciones->obtenerRecientes($usuarioId, 50, $anio);
        $cultivos = $this->cultivos->obtenerPorUsuario($usuarioId);
        $totalCultivos = $this->cultivos->contarPorUsuario($usuarioId);
        $areaTotal = $this->cultivos->areaTotalPorUsuario($usuarioId);

        if ($cultivoId) {
            $recientes = array_values(array_filter($recientes, fn($sim) => $sim['cultivo_id'] == $cultivoId));
        }

        $simCount = count($recientes);
        if ($simCount === 0) {
            return [
                'sin_datos' => true,
                'sin_simulaciones' => true,
                'mensaje' => 'No hay simulaciones registradas para esta parcela.'
            ];
        }

        $avgRend = 0; $avgTemp = 0; $avgHum = 0; $avgPrec = 0; $avgFert = 0; $avgPh = 0;
        $rendimientos = [];

        foreach ($recientes as $sim) {
            $r = floatval($sim['rendimiento_estimado'] ?? 0);
            $rendimientos[] = $r;
            $avgRend += $r;
            $avgTemp += floatval($sim['temperatura'] ?? 0);
            $avgHum  += floatval($sim['humedad'] ?? 0);
            $avgPrec += floatval($sim['precipitacion'] ?? 0);
            $avgFert += floatval($sim['fertilizante'] ?? 0);
            $avgPh   += floatval($sim['ph_suelo'] ?? 0);
        }
        $avgRend = round($avgRend / $simCount, 2);
        $avgTemp = round($avgTemp / $simCount, 1);
        $avgHum  = round($avgHum / $simCount, 1);
        $avgPrec = round($avgPrec / $simCount, 0);
        $avgFert = round($avgFert / $simCount, 0);
        $avgPh   = round($avgPh / $simCount, 1);

        sort($rendimientos);
        $p10 = $rendimientos[max(0, intval($simCount * 0.1))] ?? 4.2;
        $p50 = $rendimientos[intval($simCount * 0.5)] ?? 5.8;
        $p90 = $rendimientos[min($simCount - 1, intval($simCount * 0.9))] ?? 8.1;

        $rendimientoObjetivo = 5.4;
        $probSuperarObjetivo = 75;
        if ($avgRend > 0) {
            $z = ($avgRend - $rendimientoObjetivo) / 1.0;
            $probSuperarObjetivo = round((1.0 / (1.0 + exp(-1.5976 * $z - 0.07056 * pow($z, 3)))) * 100, 0);
            $probSuperarObjetivo = max(0, min(100, $probSuperarObjetivo));
        }

        $riesgoNivel = 'bajo';
        $riesgoColor = 'success';
        $riesgoTexto = 'Bajo';
        if ($avgTemp > 35 || $avgHum < 40 || $avgPrec < 350) {
            $riesgoNivel = 'alto'; $riesgoColor = 'danger'; $riesgoTexto = 'Alto';
        } elseif ($avgTemp > 30 || $avgHum < 50 || $avgPrec < 500 || $avgPh < 5.5 || $avgPh > 7.5) {
            $riesgoNivel = 'moderado'; $riesgoColor = 'warning'; $riesgoTexto = 'Moderado';
        }

        $estabilidad = 85;
        if ($simCount > 1 && $avgRend > 0) {
            $varianza = 0;
            foreach ($rendimientos as $r) { $varianza += pow($r - $avgRend, 2); }
            $cv = (sqrt($varianza / $simCount) / $avgRend) * 100;
            $estabilidad = max(0, round(100 - $cv, 0));
        }

        $agronomiaData = $this->catalogo->cargar();

        $selectedCultivo = null;
        if ($cultivoId) {
            $selectedCultivo = $this->cultivos->obtenerPorId($cultivoId);
        }

        $fechaSiembraRecomendada = 'No disponible';
        $userDate = null;
        $cultivoConFecha = null;
        if ($selectedCultivo) {
            if (!empty($selectedCultivo['fecha_siembra'])) {
                $cultivoConFecha = $selectedCultivo;
            }
        } else if (!empty($cultivos)) {
            foreach ($cultivos as $gc) {
                if (!empty($gc['fecha_siembra'])) { $cultivoConFecha = $gc; break; }
            }
        }
        if ($cultivoConFecha) {
            $userDate = new \DateTime($cultivoConFecha['fecha_siembra']);
        }

        $isSierra = false;
        $provincia = 'Los Ríos';
        $variedadMaiz = 'Pioneer P4039';
        if ($selectedCultivo) {
            $alt = floatval($selectedCultivo['altitud'] ?? 45.0);
            $lng = floatval($selectedCultivo['longitud'] ?? -78.5);
            $isSierra = $alt > 1000 || ($lng > -79.0 && $lng < -78.0);

            $ubicacion_lower = strtolower($selectedCultivo['ubicacion'] ?? '');
            if (strpos($ubicacion_lower, 'manabi') !== false || strpos($ubicacion_lower, 'manabí') !== false) {
                $provincia = 'Manabí';
            } elseif (strpos($ubicacion_lower, 'guayas') !== false || strpos($ubicacion_lower, 'guayaquil') !== false) {
                $provincia = 'Guayas';
            } elseif (strpos($ubicacion_lower, 'los ríos') !== false || strpos($ubicacion_lower, 'los rios') !== false || strpos($ubicacion_lower, 'quevedo') !== false) {
                $provincia = 'Los Ríos';
            } elseif (strpos($ubicacion_lower, 'loja') !== false) {
                $provincia = 'Loja';
            } elseif (strpos($ubicacion_lower, 'imbabura') !== false || strpos($ubicacion_lower, 'carchi') !== false || strpos($ubicacion_lower, 'pichincha') !== false || strpos($ubicacion_lower, 'quito') !== false || strpos($ubicacion_lower, 'aloasi') !== false || strpos($ubicacion_lower, 'aloasí') !== false) {
                $provincia = 'Pichincha';
            } elseif (strpos($ubicacion_lower, 'chimborazo') !== false || strpos($ubicacion_lower, 'bolivar') !== false || strpos($ubicacion_lower, 'bolívar') !== false) {
                $provincia = 'Chimborazo';
            } elseif (strpos($ubicacion_lower, 'cotopaxi') !== false || strpos($ubicacion_lower, 'tungurahua') !== false) {
                $provincia = 'Tungurahua';
            } elseif (strpos($ubicacion_lower, 'azuay') !== false || strpos($ubicacion_lower, 'cañar') !== false) {
                $provincia = 'Azuay';
            } elseif (strpos($ubicacion_lower, 'napo') !== false || strpos($ubicacion_lower, 'pastaza') !== false || strpos($ubicacion_lower, 'orellana') !== false || strpos($ubicacion_lower, 'morona') !== false) {
                $provincia = 'Orellana';
            }

            $variedadMaiz = $selectedCultivo['variedad_maiz'] ?? 'Pioneer P4039';
        }

        // Calendario de siembra
        $meses_siembra = [];
        $meses_cosecha = [];
        $calendarios_reales = $agronomiaData['calendario_siembra'] ?? [];

        $matching_calendars = [];
        foreach ($calendarios_reales as $cal) {
            $prov_cal = strtolower($cal['Zona / Provincia'] ?? '');
            $prov_clean = strtolower($provincia);
            if ($prov_clean === 'pichincha' || $prov_clean === 'imbabura' || $prov_clean === 'carchi') {
                $match_prov = (strpos($prov_cal, 'imbabura') !== false || strpos($prov_cal, 'pichincha') !== false || strpos($prov_cal, 'carchi') !== false);
            } elseif ($prov_clean === 'los ríos' || $prov_clean === 'los rios' || $prov_clean === 'guayas') {
                $match_prov = (strpos($prov_cal, 'los ríos') !== false || strpos($prov_cal, 'los rios') !== false || strpos($prov_cal, 'guayas') !== false);
            } else {
                $match_prov = (strpos($prov_cal, $prov_clean) !== false);
            }
            if ($match_prov) { $matching_calendars[] = $cal; }
        }

        if (!empty($matching_calendars)) {
            $meses_nombres = [
                'ENE' => 'Enero', 'FEB' => 'Febrero', 'MAR' => 'Marzo',
                'ABR' => 'Abril', 'MAY' => 'Mayo', 'JUN' => 'Junio',
                'JUL' => 'Julio', 'AGO' => 'Agosto', 'SEP' => 'Septiembre',
                'OCT' => 'Octubre', 'NOV' => 'Noviembre', 'DIC' => 'Diciembre'
            ];
            foreach ($matching_calendars as $cal) {
                foreach ($meses_nombres as $m_key => $m_val) {
                    if (isset($cal[$m_key])) {
                        if (strpos($cal[$m_key], 'S') !== false && !in_array($m_val, $meses_siembra)) { $meses_siembra[] = $m_val; }
                        if (strpos($cal[$m_key], 'C') !== false && !in_array($m_val, $meses_cosecha)) { $meses_cosecha[] = $m_val; }
                    }
                }
            }
        }

        if ($userDate) {
            if (!empty($meses_siembra)) {
                $monthNamesToNum = [
                    'Enero' => 1, 'Febrero' => 2, 'Marzo' => 3, 'Abril' => 4,
                    'Mayo' => 5, 'Junio' => 6, 'Julio' => 7, 'Agosto' => 8,
                    'Septiembre' => 9, 'Octubre' => 10, 'Noviembre' => 11, 'Diciembre' => 12
                ];
                $userMonthNum = intval($userDate->format('m'));
                $userDayNum = intval($userDate->format('d'));
                $userYear = intval($userDate->format('Y'));
                $isAlreadyOptimal = false;
                $userMonthName = '';
                foreach ($meses_siembra as $optMonthName) {
                    if (isset($monthNamesToNum[$optMonthName]) && $monthNamesToNum[$optMonthName] == $userMonthNum) {
                        $isAlreadyOptimal = true; $userMonthName = $optMonthName; break;
                    }
                }
                if ($isAlreadyOptimal) {
                    $bestMonthName = $userMonthName; $bestMonthNum = $userMonthNum;
                    $targetDay = $userDayNum; $dist = 0;
                } else {
                    $minDist = 999; $bestMonthName = ''; $bestMonthNum = null;
                    foreach ($meses_siembra as $optMonthName) {
                        if (isset($monthNamesToNum[$optMonthName])) {
                            $optMonthNum = $monthNamesToNum[$optMonthName];
                            $dist = abs($userMonthNum - $optMonthNum);
                            $dist = min($dist, 12 - $dist);
                            if ($dist < $minDist) { $minDist = $dist; $bestMonthName = $optMonthName; $bestMonthNum = $optMonthNum; }
                        }
                    }
                    if ($bestMonthNum !== null) {
                        $tempDate = new \DateTime();
                        $tempDate->setDate($userYear, $bestMonthNum, 1);
                        $daysInTargetMonth = intval($tempDate->format('t'));
                        $targetDay = min($userDayNum, $daysInTargetMonth);
                        $dist = $minDist;
                    } else {
                        $bestMonthName = $meses_siembra[0];
                        $bestMonthNum = $monthNamesToNum[$bestMonthName] ?? 10;
                        $targetDay = 15; $dist = 999;
                    }
                }
                $isCloseToPlanned = ($dist <= 3);
                $proposedRecDate = new \DateTime();
                $proposedRecDate->setDate($userYear, $bestMonthNum, $targetDay);
                $today = new \DateTime();
                $isPast = ($proposedRecDate < $today);
                $diff = $today->diff($proposedRecDate);
                $monthsDiffFromToday = ($diff->y * 12) + $diff->m;
                $isNextYearOrFar = ($userYear > intval($today->format('Y'))) || ($monthsDiffFromToday > 6);
                if ($isPast || ($isNextYearOrFar && !$isCloseToPlanned)) {
                    $fechaSiembraRecomendada = $this->formatOptimalMonths($meses_siembra);
                } else {
                    $fechaSiembraRecomendada = $targetDay . ' de ' . $bestMonthName;
                }
            } else {
                $meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                $fechaSiembraRecomendada = $userDate->format('d') . ' de ' . $meses[intval($userDate->format('m')) - 1];
            }
        } else {
            if (!empty($meses_siembra)) {
                $fechaSiembraRecomendada = $this->formatOptimalMonths($meses_siembra);
            } else {
                $fechaSiembraRecomendada = $isSierra ? '15 de Octubre' : '15 de Diciembre';
            }
        }

        // Calendario de viabilidad
        $region = 'Costa';
        if ($selectedCultivo) {
            $alt = floatval($selectedCultivo['altitud'] ?? 45.0);
            $lng = floatval($selectedCultivo['longitud'] ?? -78.5);
            $isSierra = $alt > 1000 || ($lng > -79.0 && $lng < -78.0);
            $isAmazon = $lng > -77.5;
            if ($isSierra) { $region = 'Sierra'; }
            elseif ($isAmazon) { $region = 'Amazonía'; }
        } else { $region = 'Sierra'; }

        $calendario_viabilidad = [];
        $region_lower = strtolower($region);
        foreach (($agronomiaData['calendario_siembra'] ?? []) as $row) {
            $zona_prov = $row['Zona / Provincia'] ?? '';
            $zona_prov_lower = strtolower($zona_prov);
            if (strpos($zona_prov_lower, 'leyenda') !== false || strpos($zona_prov_lower, 'nota:') !== false) { continue; }
            $row_region = '';
            if (strpos($zona_prov_lower, 'imbabura') !== false || strpos($zona_prov_lower, 'carchi') !== false || strpos($zona_prov_lower, 'pichincha') !== false || strpos($zona_prov_lower, 'bolívar') !== false || strpos($zona_prov_lower, 'chimborazo') !== false || strpos($zona_prov_lower, 'cañar') !== false || strpos($zona_prov_lower, 'azuay') !== false || strpos($zona_prov_lower, 'cotopaxi') !== false || strpos($zona_prov_lower, 'tungurahua') !== false || (strpos($zona_prov_lower, 'loja') !== false && strpos($zona_prov_lower, 'sierra') !== false) || strpos($zona_prov_lower, 'sierra') !== false) {
                $row_region = 'sierra';
            } elseif (strpos($zona_prov_lower, 'sucumbíos') !== false || strpos($zona_prov_lower, 'sucumbios') !== false || strpos($zona_prov_lower, 'orellana') !== false || strpos($zona_prov_lower, 'napo') !== false || strpos($zona_prov_lower, 'pastaza') !== false || strpos($zona_prov_lower, 'amazon') !== false) {
                $row_region = 'amazonía';
            } else { $row_region = 'costa'; }
            $match_provincia = false;
            $prov_clean = strtolower($provincia);
            if ($selectedCultivo) {
                if ($prov_clean === 'pichincha' || $prov_clean === 'imbabura' || $prov_clean === 'carchi') {
                    $match_provincia = (strpos($zona_prov_lower, 'imbabura') !== false || strpos($zona_prov_lower, 'pichincha') !== false || strpos($zona_prov_lower, 'carchi') !== false);
                } elseif ($prov_clean === 'los ríos' || $prov_clean === 'los rios' || $prov_clean === 'guayas') {
                    $match_provincia = (strpos($zona_prov_lower, 'los ríos') !== false || strpos($zona_prov_lower, 'los rios') !== false || strpos($zona_prov_lower, 'guayas') !== false);
                } else {
                    $match_provincia = (strpos($zona_prov_lower, $prov_clean) !== false);
                }
            } else { $match_provincia = ($row_region === $region_lower); }
            if ($match_provincia) {
                $months = ['ENE' => ['Enero', 31],'FEB' => ['Febrero', 28],'MAR' => ['Marzo', 31],'ABR' => ['Abril', 30],'MAY' => ['Mayo', 31],'JUN' => ['Junio', 30],'JUL' => ['Julio', 31],'AGO' => ['Agosto', 31],'SEP' => ['Septiembre', 30],'OCT' => ['Octubre', 31],'NOV' => ['Noviembre', 30],'DIC' => ['Diciembre', 31]];
                foreach ($months as $m_key => $m_data) {
                    $m_val = trim($row[$m_key] ?? '');
                    if ($m_val === 'S') {
                        $calendario_viabilidad[] = ['rango' => "1–{$m_data[1]} {$m_key}",'estado' => "Siembra: {$zona_prov}",'evaluacion' => 'muy_favorable','color' => 'success','nota' => "Época óptima de siembra recomendada en la zona {$zona_prov} ({$row['Tipo Maíz']}) para obtener el máximo rendimiento."];
                    } elseif ($m_val === 'C') {
                        $calendario_viabilidad[] = ['rango' => "1–{$m_data[1]} {$m_key}",'estado' => "Cosecha: {$zona_prov}",'evaluacion' => 'favorable','color' => 'info','nota' => "Periodo de cosecha estimado en la zona {$zona_prov} ({$row['Tipo Maíz']}) según ciclo fenológico."];
                    }
                }
            }
        }
        if (empty($calendario_viabilidad)) {
            $calendario_viabilidad = [['rango' => '15–31 Dic','estado' => 'Siembra Recomendada','evaluacion' => 'muy_favorable','color' => 'success','nota' => 'Ventana óptima general recomendada.']];
        }

        // Zona Excel y variedades
        $excelZone = 'Costa';
        if ($selectedCultivo) {
            $alt = floatval($selectedCultivo['altitud'] ?? 45.0);
            $ubic = strtolower($selectedCultivo['ubicacion'] ?? '');
            if ($alt > 1000) {
                if (strpos($ubic, 'imbabura') !== false || strpos($ubic, 'pichincha') !== false || strpos($ubic, 'carchi') !== false) { $excelZone = 'Sierra Norte'; }
                elseif (strpos($ubic, 'bolívar') !== false || strpos($ubic, 'chimborazo') !== false || strpos($ubic, 'cotopaxi') !== false || strpos($ubic, 'tungurahua') !== false) { $excelZone = 'Sierra Centro'; }
                elseif (strpos($ubic, 'azuay') !== false || strpos($ubic, 'cañar') !== false || strpos($ubic, 'loja') !== false) { $excelZone = 'Sierra Sur'; }
                else { $excelZone = 'Sierra'; }
            } elseif (strpos($ubic, 'napo') !== false || strpos($ubic, 'pastaza') !== false || strpos($ubic, 'orellana') !== false || strpos($ubic, 'morona') !== false || strpos($ubic, 'sucumbíos') !== false || strpos($ubic, 'sucumbios') !== false) {
                $excelZone = 'Amazonía';
            }
        }

        $varieties_in_zone = [];
        foreach (($agronomiaData['variedades_por_zona'] ?? []) as $v) {
            $v_zone = strtolower($v['Zona'] ?? '');
            $ez_lower = strtolower($excelZone);
            if (strpos($v_zone, $ez_lower) !== false || ($ez_lower === 'sierra' && strpos($v_zone, 'sierra') !== false)) { $varieties_in_zone[] = $v; }
        }
        if (count($varieties_in_zone) < 3) {
            $varieties_in_zone = [
                ['Nombre / Código' => 'Dekalb DK-7088', 'Rendim. Promedio (t/ha)' => '7.69', 'Rendim. Máx. (t/ha)' => '8.5'],
                ['Nombre / Código' => 'Pioneer P4039', 'Rendim. Promedio (t/ha)' => '8.14', 'Rendim. Máx. (t/ha)' => '10.0'],
                ['Nombre / Código' => 'INIAP H-603 \'Superior\'', 'Rendim. Promedio (t/ha)' => '9.7', 'Rendim. Máx. (t/ha)' => '12.0'],
                ['Nombre / Código' => 'INIAP 102 Blanco', 'Rendim. Promedio (t/ha)' => '8.5', 'Rendim. Máx. (t/ha)' => '9.8'],
                ['Nombre / Código' => 'ADV 9313', 'Rendim. Promedio (t/ha)' => '7.8', 'Rendim. Máx. (t/ha)' => '9.2']
            ];
        } else { usort($varieties_in_zone, fn($a, $b) => floatval($b['Rendim. Promedio (t/ha)'] ?? 0) <=> floatval($a['Rendim. Promedio (t/ha)'] ?? 0)); }

        $top_varieties = array_slice($varieties_in_zone, 0, 5);
        $fechasSimuladas = [];
        if (!empty($meses_siembra)) {
            $primero = $meses_siembra[0];
            $segundo = count($meses_siembra) > 1 ? $meses_siembra[1] : $primero;
            $fechasSimuladas = ["Temprana ({$primero})", "Media ({$primero})", "Tardía ({$segundo})"];
        } else { $fechasSimuladas = ['Temprana (Oct)', 'Media (Nov)', 'Tardía (Dic)']; }

        $heatmapData = [];
        foreach ($fechasSimuladas as $fi => $fecha) {
            foreach ($top_varieties as $hi => $v) {
                $name = $v['Nombre / Código'] ?? 'Variedad';
                $base_rdto = floatval($v['Rendim. Promedio (t/ha)'] ?? 5.0);
                $fecha_penalty = ($fi - 1) * -0.5;
                $hash = crc32($name . $fecha) % 10 / 10.0 - 0.5;
                $val = round($base_rdto + $fecha_penalty + $hash, 1);
                $heatmapData[] = ['fecha' => $fecha, 'hibrido' => $name, 'valor' => max(0.5, $val)];
            }
        }

        $best_var = $top_varieties[0]['Nombre / Código'] ?? 'Dekalb DK-7088';
        $best_rdto = floatval($top_varieties[0]['Rendim. Promedio (t/ha)'] ?? 7.69);
        $best_max = floatval($top_varieties[0]['Rendim. Máx. (t/ha)'] ?? ($best_rdto * 1.2));
        $med_var = $top_varieties[1]['Nombre / Código'] ?? 'Pioneer P4039';
        $med_rdto = floatval($top_varieties[1]['Rendim. Promedio (t/ha)'] ?? 8.14);
        $est_var = $top_varieties[2]['Nombre / Código'] ?? 'INIAP H-603';
        $est_rdto = floatval($top_varieties[2]['Rendim. Promedio (t/ha)'] ?? 9.7);
        $v3_var = $top_varieties[3]['Nombre / Código'] ?? 'INIAP 102 Blanco';
        $v3_rdto = floatval($top_varieties[3]['Rendim. Promedio (t/ha)'] ?? 8.5);
        $v4_var = $top_varieties[4]['Nombre / Código'] ?? 'ADV 9313';
        $v4_rdto = floatval($top_varieties[4]['Rendim. Promedio (t/ha)'] ?? 7.8);

        $ranking = [
            ['estrategia' => 'Rendimiento Máximo','combinacion' => "{$best_var} + Siembra Temprana",'valor' => round($best_max, 2),'unidad' => 't/ha','badge' => 'Recomendado','porque' => "Maximiza la captación de radiación solar y la fotosíntesis C4 en la fase vegetativa, evitando pérdidas por estrés hídrico en floración VT."],
            ['estrategia' => 'Menor Riesgo Climático','combinacion' => "{$med_var} + Siembra Media",'valor' => round($med_rdto, 2),'unidad' => 't/ha','badge' => 'Estable','porque' => "Evita las lluvias extremas o variaciones térmicas bruscas de inicio de temporada, protegiendo las plántulas en su germinación."],
            ['estrategia' => 'Máxima Estabilidad','combinacion' => "{$est_var} + Siembra Temprana",'valor' => round($est_rdto, 2),'unidad' => 't/ha','badge' => 'Resiliente','porque' => "Mantiene un rendimiento constante (<8% de variación) tanto en años secos como en temporadas con exceso de precipitaciones."],
            ['estrategia' => 'Alta Eficiencia de N','combinacion' => "{$v3_var} + Siembra Temprana",'valor' => round($v3_rdto, 2),'unidad' => 't/ha','badge' => 'Eficiente','porque' => "Presenta la mayor tasa de conversión de nitrógeno a biomasa de grano, reduciendo la necesidad de sobre-fertilización sintética."],
            ['estrategia' => 'Resiliencia Hídrica','combinacion' => "{$v4_var} + Siembra Media",'valor' => round($v4_rdto, 2),'unidad' => 't/ha','badge' => 'Tolerante','porque' => "Su arquitectura radicular profunda le permite tolerar veranillos imprevistos de hasta 18 días sin reducir el llenado de mazorca."]
        ];

        $recomendaciones = [];
        if ($avgTemp > 32) {
            $recomendaciones[] = ['tipo' => 'danger','icono' => 'Thermometer','titulo' => 'Alerta: Estrés Térmico','texto' => "La temperatura promedio ({$avgTemp}°C) excede el umbral óptimo. Considere cambiar la fecha de siembra a un período más fresco o usar riego por aspersión para mitigar el calor.",'accion' => 'Cambiar fecha de siembra'];
        } elseif ($avgTemp > 28) {
            $recomendaciones[] = ['tipo' => 'warning','icono' => 'ThermometerSun','titulo' => 'Monitorear Temperatura','texto' => "La temperatura promedio ({$avgTemp}°C) está en rango medio-alto. Monitorear floración para evitar aborto de granos.",'accion' => 'Programar riego complementario'];
        }
        if ($avgFert < 150) {
            $recomendaciones[] = ['tipo' => 'warning','icono' => 'Sprout','titulo' => 'Plan de Nutrición N-P-K y Zinc Subóptimo','texto' => "La dosis de nitrógeno ({$avgFert} kg N/ha) es baja. El maíz en Ecuador requiere un balance completo: Fósforo (P₂O₅) al inicio para enraizamiento, Potasio (K₂O) para llenado de grano y Zinc (Zn) como regulador enzimático.",'accion' => 'Optimizar nutrición NPK+Zn'];
        }
        if ($avgPh < 5.5) {
            $recomendaciones[] = ['tipo' => 'danger','icono' => 'Flame','titulo' => 'Suelo Ácido','texto' => "El pH del suelo ({$avgPh}) es demasiado ácido. Se recomienda aplicar cal agrícola (2-3 t/ha) para corregir la acidez.",'accion' => 'Aplicar encalado'];
        } elseif ($avgPh > 7.5) {
            $recomendaciones[] = ['tipo' => 'warning','icono' => 'Flame','titulo' => 'Suelo Alcalino','texto' => "El pH ({$avgPh}) es elevado. Evaluar aplicación de azufre o materia orgánica.",'accion' => 'Corregir pH con azufre'];
        }
        if ($avgPrec < 500) {
            $recomendaciones[] = ['tipo' => 'danger','icono' => 'CloudRainWind','titulo' => 'Déficit Hídrico','texto' => "La precipitación ({$avgPrec} mm/año) es insuficiente para maíz. Se requiere riego suplementario obligatorio.",'accion' => 'Implementar sistema de riego'];
        }
        if (empty($recomendaciones)) {
            $recomendaciones[] = ['tipo' => 'success','icono' => 'CheckCircle','titulo' => 'Condiciones Óptimas','texto' => 'Todos los parámetros están dentro de los rangos óptimos para el cultivo de maíz. Mantener el manejo actual.','accion' => 'Mantener plan actual'];
        }

        return [
            'cultivo_activo' => $selectedCultivo,
            'recomendaciones' => $recomendaciones,
            'kpis' => [
                'rendimiento_esperado' => $avgRend,
                'prob_superar_objetivo' => $probSuperarObjetivo,
                'riesgo_agronomico' => ['nivel' => $riesgoNivel,'color' => $riesgoColor,'texto' => $riesgoTexto],
                'estabilidad' => $estabilidad,
                'fecha_siembra_recomendada' => $fechaSiembraRecomendada
            ],
            'percentiles' => ['p10' => round($p10, 2),'p50' => round($p50, 2),'p90' => round($p90, 2)],
            'heatmap' => $heatmapData,
            'ranking' => $ranking,
            'viabilidad_siembra' => $calendario_viabilidad,
            'simulaciones_count' => $simCount
        ];
    }

    private function formatOptimalMonths(array $months): string
    {
        if (empty($months)) { return 'No disponible'; }
        if (count($months) === 1) { return $months[0]; }
        if (count($months) === 2) { return $months[0] . ' y ' . $months[1]; }
        $last = array_pop($months);
        return implode(', ', $months) . ' y ' . $last;
    }
}