<?php
// src/Dominios/Analitica/Aplicacion/ServicioAnaliticaClimate.php — Servicio que construye los datos del dashboard Climate.
// Port verbatim de ClimateController::index() (líneas 231-581), adaptado a return array.
// Sustituye la llamada interna consultarDatosApiPrecision() por el ServicioDatosTerreno inyectado.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

class ServicioAnaliticaClimate
{
    public function __construct(
        private CatalogoAgronomicoInterface $catalogo,
        private CultivoRepositoryInterface $cultivos,
        private ServicioDatosTerreno $terreno
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId = null, ?int $anio = null): array
    {
        $cultivoSeleccionado = null;

        if ($cultivoId) {
            $cultivoSeleccionado = $this->cultivos->obtenerPorId($cultivoId);
            if (!$cultivoSeleccionado || $cultivoSeleccionado['usuario_id'] != $usuarioId) {
                throw new AccesoDenegadoException('Esta parcela no es válida o no está registrada a tu nombre.');
            }
        }

        if (!$cultivoSeleccionado) {
            $totalCultivos = $this->cultivos->contarPorUsuario($usuarioId);
            return ['sin_datos' => true, 'total_cultivos' => $totalCultivos];
        }

        $temperaturaPromedio = 24.5;
        $humedadPromedio = 65.0;
        $precipitacionPromedio = 800.0;
        $fuenteApi = 'Simulado/Histórico';
        $sueloInfo = null;

        if (!empty($cultivoSeleccionado['latitud']) && !empty($cultivoSeleccionado['longitud'])) {
            $altitud = !empty($cultivoSeleccionado['altitud']) ? floatval($cultivoSeleccionado['altitud']) : null;
            $informacionApi = $this->terreno->obtener(
                floatval($cultivoSeleccionado['latitud']),
                floatval($cultivoSeleccionado['longitud']),
                $altitud
            );
            if ($informacionApi['success']) {
                $temperaturaPromedio = $informacionApi['clima']['temperatura'];
                $humedadPromedio = $informacionApi['clima']['humedad'];
                $precipitacionPromedio = $informacionApi['clima']['precipitacion'];
                $fuenteApi = $informacionApi['source'];
                $sueloInfo = $informacionApi['suelo'];
            }
        }

        $year = $anio ?? 2026;

        $ensoEstado = 'Neutral';
        $ensoColor = 'success';
        $ensoDesc = 'Condiciones ENSO estables y neutrales en el Pacífico Ecuatorial';

        if ($year === 2026) {
            $ensoEstado = 'Niño (Activo)';
            $ensoColor = 'danger';
            $ensoDesc = 'Fenómeno global de El Niño activo para el período 2026 en todo el país';
        } elseif ($year === 2025) {
            $ensoEstado = 'Niña (Activo)';
            $ensoColor = 'warning';
            $ensoDesc = 'Fase activa global de La Niña registrada para el período 2025';
        }

        $probLluviaBaja = $precipitacionPromedio < 700 ? round(max(20, min(85, 100 - ($precipitacionPromedio / 10))), 0) : round(max(10, 70 - ($precipitacionPromedio / 15)), 0);
        $probEstrTermico = $temperaturaPromedio > 30 ? round(min(90, ($temperaturaPromedio - 25) * 15), 0) : round(max(5, ($temperaturaPromedio - 20) * 5), 0);

        if ($sueloInfo) {
            $aguaUtil = round($sueloInfo['sand'] * 0.6 + $sueloInfo['clay'] * 1.8 + $sueloInfo['silt'] * 1.2, 0);
            $aguaUtil = max(30, min(200, $aguaUtil));
        } else {
            $aguaUtil = round(max(30, min(180, $precipitacionPromedio * 0.15 + $humedadPromedio * 0.5)), 0);
        }

        $indiceRiesgoClima = 'Bajo';
        $indiceRiesgoColor = 'success';
        if ($probLluviaBaja > 60 || $probEstrTermico > 50) {
            $indiceRiesgoClima = 'Alto';
            $indiceRiesgoColor = 'danger';
        } elseif ($probLluviaBaja > 35 || $probEstrTermico > 25) {
            $indiceRiesgoClima = 'Moderado';
            $indiceRiesgoColor = 'warning';
        }

        $etiquetasMeses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        $anomaliaLluvia = [];
        $anomaliaTemp = [];
        $promedioHistLluvia = [];

        if (!empty($cultivoSeleccionado['latitud'])) {
            $latitud = floatval($cultivoSeleccionado['latitud']);
            $longitud = floatval($cultivoSeleccionado['longitud']);
            $altitud = floatval($cultivoSeleccionado['altitud'] ?? 45.0);

            $esSierra = $altitud > 1000 || ($longitud > -79.0 && $longitud < -78.0);
            $esAmazonia = $longitud > -77.5;

            for ($i = 0; $i < 12; $i++) {
                if ($esSierra) {
                    $temperaturaBase = 15.0 + sin(deg2rad($i * 30 + 60)) * 1.5;
                    $lluviaBase = 80.0 + sin(deg2rad($i * 60)) * 30.0;
                } elseif ($esAmazonia) {
                    $temperaturaBase = 24.0 + sin(deg2rad($i * 30 + 120)) * 0.8;
                    $lluviaBase = 160.0 + cos(deg2rad($i * 30)) * 40.0;
                } else {
                    $temperaturaBase = 26.0 + sin(deg2rad($i * 30 + 90)) * 1.2;
                    $lluviaBase = ($i >= 0 && $i <= 3) ? (160.0 - $i * 35) : 12.0;
                }
                $promedioHistLluvia[] = round($lluviaBase, 1);
                $anomaliaLluvia[] = round($lluviaBase + mt_rand(-10, 15), 1);
                $anomaliaTemp[] = round($temperaturaBase + mt_rand(-8, 8) / 10, 1);
            }
        } else {
            for ($i = 0; $i < 12; $i++) {
                $baseLluvia = 60 + sin(deg2rad($i * 30)) * 30;
                $anomaliaLluvia[] = round($baseLluvia + mt_rand(-20, 15), 1);
                $promedioHistLluvia[] = round($baseLluvia, 1);
                $anomaliaTemp[] = round($temperaturaPromedio + sin(deg2rad($i * 30 + 90)) * 3 + mt_rand(-10, 10) / 10, 1);
            }
        }

        if ($sueloInfo) {
            $aguaPorEstrato = [
                round($aguaUtil * ($sueloInfo['clay'] / 100), 0),
                round($aguaUtil * ($sueloInfo['silt'] / 100), 0),
                round($aguaUtil * ($sueloInfo['sand'] / 100), 0),
                0
            ];
            $aguaPorEstrato[3] = max(0, $aguaUtil - array_sum(array_slice($aguaPorEstrato, 0, 3)));
        } else {
            $aguaPorEstrato = [
                round($aguaUtil * 0.35, 0),
                round($aguaUtil * 0.28, 0),
                round($aguaUtil * 0.22, 0),
                round($aguaUtil * 0.15, 0)
            ];
        }

        $emergenciaMes = 'Mes 1';
        $crecimientoMes = 'Mes 2';
        $floracionMes = 'Mes 3';
        $llenadoMes = 'Mes 4';

        if (!empty($cultivoSeleccionado['fecha_siembra'])) {
            $fechaSiembraObj = new \DateTime($cultivoSeleccionado['fecha_siembra']);
            $meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            $emergenciaMes = $meses[intval($fechaSiembraObj->format('m')) - 1];
            $fechaCrecimiento = clone $fechaSiembraObj;
            $fechaCrecimiento->modify('+1 month');
            $crecimientoMes = $meses[intval($fechaCrecimiento->format('m')) - 1];
            $fechaFloracion = clone $fechaSiembraObj;
            $fechaFloracion->modify('+2 months');
            $floracionMes = $meses[intval($fechaFloracion->format('m')) - 1];
            $fechaLlenado = clone $fechaSiembraObj;
            $fechaLlenado->modify('+3 months');
            $llenadoMes = $meses[intval($fechaLlenado->format('m')) - 1];
        } else {
            $emergenciaMes = 'Oct-Nov';
            $crecimientoMes = 'Nov-Dic';
            $floracionMes = 'Ene-Feb';
            $llenadoMes = 'Mar-Apr';
        }

        $datosAgronomia = $this->catalogo->cargar();

        $esSierra = false;
        $zonaEcuador = 'Costa – Litoral (Invierno)';
        if ($cultivoSeleccionado) {
            $altitud = floatval($cultivoSeleccionado['altitud'] ?? 45.0);
            $ubicacion = strtolower($cultivoSeleccionado['ubicacion'] ?? '');
            if ($altitud > 1000) {
                $esSierra = true;
                if (strpos($ubicacion, 'imbabura') !== false || strpos($ubicacion, 'pichincha') !== false || strpos($ubicacion, 'carchi') !== false) {
                    $zonaEcuador = 'Sierra Norte';
                } elseif (strpos($ubicacion, 'bolívar') !== false || strpos($ubicacion, 'chimborazo') !== false || strpos($ubicacion, 'cotopaxi') !== false || strpos($ubicacion, 'tungurahua') !== false) {
                    $zonaEcuador = 'Sierra Centro';
                } elseif (strpos($ubicacion, 'azuay') !== false || strpos($ubicacion, 'cañar') !== false || strpos($ubicacion, 'loja') !== false) {
                    $zonaEcuador = 'Sierra Sur';
                } else {
                    $zonaEcuador = 'Sierra Norte';
                }
            } elseif (strpos($ubicacion, 'napo') !== false || strpos($ubicacion, 'pastaza') !== false || strpos($ubicacion, 'orellana') !== false || strpos($ubicacion, 'morona') !== false || strpos($ubicacion, 'sucumbíos') !== false || strpos($ubicacion, 'sucumbios') !== false) {
                $zonaEcuador = 'Amazonía';
            }
        }

        $condicionesEncontradas = null;
        foreach (($datosAgronomia['condiciones_agronomicas'] ?? []) as $cond) {
            if (strpos(strtolower($cond['Zona'] ?? ''), strtolower($zonaEcuador)) !== false) {
                $condicionesEncontradas = $cond;
                break;
            }
        }

        $fertilizacionEncontrada = null;
        $palabraClaveZonaFert = $esSierra ? 'Sierra' : 'Costa';
        foreach (($datosAgronomia['fertilizacion'] ?? []) as $fert) {
            if (strpos(strtolower($fert['Zona'] ?? ''), strtolower($palabraClaveZonaFert)) !== false) {
                $fertilizacionEncontrada = $fert;
                break;
            }
        }

        $temp_optima = $condicionesEncontradas['Temperatura Óptima (°C)'] ?? '21–27';
        $ph_optimo = $condicionesEncontradas['pH Óptimo'] ?? '6.0–6.5';
        $tipo_suelo = $condicionesEncontradas['Tipo de Suelo'] ?? 'Franco arcilloso / Franco limoso';
        $densidad = $condicionesEncontradas['Densidad (pl/ha)'] ?? '62,500–83,333';
        $riego = $condicionesEncontradas['Riego'] ?? 'Temporal (lluvia)';
        $ciclo_dias = $condicionesEncontradas['Ciclo (días)'] ?? '115–125';

        $nitrogeno = $fertilizacionEncontrada['Nitrógeno N (kg/ha)'] ?? '180–200';
        $fraccionamiento = $fertilizacionEncontrada['Fraccionamiento N'] ?? '3 aplicaciones fraccionadas';
        $biofertilizante = $fertilizacionEncontrada['Biofertilizante INIAP'] ?? 'N/A';

        $plagas = $datosAgronomia['plagas_enfermedades'] ?? [];
        $generarTextoPlagas = function($nombreEtapa) use ($plagas, $esSierra) {
            $coincidencias = [];
            foreach ($plagas as $p) {
                $p_zona = strtolower($p['Zona'] ?? '');
                $match_zone = false;
                if (strpos($p_zona, 'todo el ecuador') !== false || strpos($p_zona, 'general') !== false || strpos($p_zona, 'toda región') !== false) {
                    $match_zone = true;
                } else if ($esSierra && (strpos($p_zona, 'sierra') !== false || strpos($p_zona, 'andina') !== false)) {
                    $match_zone = true;
                } else if (!$esSierra && (strpos($p_zona, 'costa') !== false || strpos($p_zona, 'litoral') !== false || strpos($p_zona, 'amazon') !== false)) {
                    $match_zone = true;
                }
                if (!$match_zone) continue;
                $etapa = strtolower($p['Etapa Crítica'] ?? '');
                $match_stage = false;
                if ($nombreEtapa === 'Emergencia') {
                    if (strpos($etapa, 'emergencia') !== false || strpos($etapa, '0–15') !== false || strpos($etapa, 'v1') !== false) { $match_stage = true; }
                } elseif ($nombreEtapa === 'Crecimiento') {
                    if (strpos($etapa, 'v2') !== false || strpos($etapa, 'v3') !== false || strpos($etapa, 'v4') !== false || strpos($etapa, 'v6') !== false || strpos($etapa, 'v8') !== false || strpos($etapa, 'vegetativo') !== false) { $match_stage = true; }
                } elseif ($nombreEtapa === 'Floración') {
                    if (strpos($etapa, 'r1') !== false || strpos($etapa, 'r2') !== false || strpos($etapa, 'floración') !== false || strpos($etapa, 'seda') !== false) { $match_stage = true; }
                } elseif ($nombreEtapa === 'Llenado de grano') {
                    if (strpos($etapa, 'r3') !== false || strpos($etapa, 'r4') !== false || strpos($etapa, 'llenado') !== false || strpos($etapa, 'grano') !== false) { $match_stage = true; }
                }
                if ($match_stage) {
                    $name = $p['Nombre Común'] ?? 'Plaga';
                    $umbral = str_replace("\n", " ", $p['Umbral\nAcción'] ?? $p['Umbral Acción'] ?? 'Monitoreo');
                    $control = str_replace("\n", " ", $p['Control Químico'] ?? 'N/A');
                    $coincidencias[] = "{$name} (Umbral: {$umbral}; Control: {$control})";
                }
            }
            if (empty($coincidencias)) { return "No se registran plagas de alta incidencia."; }
            return "Plagas clave: " . implode(" | ", $coincidencias);
        };

        $lineaTiempoFenologica = [
            ['etapa' => 'Emergencia','mes' => $emergenciaMes,'riesgo' => 'Bajo Riesgo','alerta' => 'Bajo','color' => 'success','descripcion' => "Suelo: {$tipo_suelo} (pH óptimo: {$ph_optimo}). Densidad objetivo: {$densidad} pl/ha. Riego: {$riego}. " . $generarTextoPlagas('Emergencia')],
            ['etapa' => 'Crecimiento','mes' => $crecimientoMes,'riesgo' => 'Riesgo Moderado','alerta' => 'Moderado','color' => 'warning','descripcion' => "Fertilización recomendada: {$nitrogeno} kg/ha de N. Fraccionamiento: {$fraccionamiento}. Biofertilización: {$biofertilizante}. " . $generarTextoPlagas('Crecimiento')],
            ['etapa' => 'Floración','mes' => $floracionMes,'riesgo' => 'Alto Riesgo','alerta' => 'Alto','color' => 'danger','descripcion' => "Temperatura óptima de desarrollo: {$temp_optima} °C. Evitar encharcamientos o sequías extremas durante polinización. " . $generarTextoPlagas('Floración')],
            ['etapa' => 'Llenado de grano','mes' => $llenadoMes,'riesgo' => 'Riesgo Moderado','alerta' => 'Moderado','color' => 'warning','descripcion' => "Duración estimada del ciclo en esta zona: {$ciclo_dias} días. Mantener humedad residual. " . $generarTextoPlagas('Llenado de grano')]
        ];

        return [
            'kpis' => [
                'enso' => ['estado' => $ensoEstado,'color' => $ensoColor,'desc' => $ensoDesc],
                'prob_lluvia_bajo_promedio' => $probLluviaBaja,
                'prob_estres_termico' => $probEstrTermico,
                'agua_util' => $aguaUtil,
                'indice_riesgo' => ['nivel' => $indiceRiesgoClima,'color' => $indiceRiesgoColor]
            ],
            'api_source' => $fuenteApi,
            'clima_actual' => [
                'temperatura' => $temperaturaPromedio,
                'humedad' => $humedadPromedio,
                'precipitacion' => $precipitacionPromedio
            ],
            'timeline_anomalia' => [
                'labels' => $etiquetasMeses,
                'lluvia_historica' => $promedioHistLluvia,
                'lluvia_anomala' => $anomaliaLluvia,
                'temperatura_anomala' => $anomaliaTemp
            ],
            'agua_estratos' => [
                'labels' => ['0-20 cm', '20-40 cm', '40-60 cm', '60-100 cm'],
                'valores' => $aguaPorEstrato
            ],
            'timeline_fenologico' => $lineaTiempoFenologica,
            'fecha_siembra' => $cultivoSeleccionado ? $cultivoSeleccionado['fecha_siembra'] : null
        ];
    }
}