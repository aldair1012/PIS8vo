<?php
// ClimateController.php - Dashboard de clima y riesgo. Consume las APIs de Open-Meteo y SoilGrids.

require_once __DIR__ . '/../models/Cultivo.php';
require_once __DIR__ . '/../models/Simulacion.php';

class ClimateController
{
    private Cultivo $cultivo;
    private Simulacion $simulacion;

    public function __construct()
    {
        $this->cultivo = new Cultivo();
        $this->simulacion = new Simulacion();
    }

    private function obtenerUsuarioAutenticadoOError()
    {
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No estás autenticado en el sistema. Por favor inicia sesión.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        return $_SESSION['usuario_id'];
    }

    public function consultarDatosApiPrecision(float $latitud, float $longitud, ?float $altitud = null): array
    {
        $rutaCache = __DIR__ . '/../data/cache';
        if (!is_dir($rutaCache)) {
            @mkdir($rutaCache, 0777, true);
        }
        
        $claveLat = round($latitud, 3);
        $claveLng = round($longitud, 3);
        $archivoCache = "{$rutaCache}/precision_data_{$claveLat}_{$claveLng}.json";
        
        if (file_exists($archivoCache) && (time() - filemtime($archivoCache) < 86400)) {
            $datosCache = json_decode(file_get_contents($archivoCache), true);
            if ($datosCache) {
                $datosCache['source'] .= ' (Caché local de la parcela)';
                return $datosCache;
            }
        }

        // Si no se pasó la altitud, intentar recuperarla del cultivo en la BD usando coordenadas aproximadas
        if ($altitud === null) {
            try {
                $conexionBd = getConnection();
                $sentencia = $conexionBd->prepare("SELECT altitud FROM cultivos WHERE ROUND(latitud, 3) = ROUND(:lat, 3) AND ROUND(longitud, 3) = ROUND(:lng, 3) LIMIT 1");
                $sentencia->execute(['lat' => $latitud, 'lng' => $longitud]);
                $cultivoBd = $sentencia->fetch(PDO::FETCH_ASSOC);
                if ($cultivoBd && !empty($cultivoBd['altitud'])) {
                    $altitud = floatval($cultivoBd['altitud']);
                }
            } catch (Exception $e) {
                // Ignorar
            }
        }

        // Estimar región e indicar temperatura adecuada
        $esSierra = false;
        $esAmazonia = false;
        if ($altitud !== null) {
            $esSierra = $altitud > 1000 || ($longitud > -79.0 && $longitud < -78.0);
            $esAmazonia = $longitud > -77.5;
        } else {
            $esSierra = ($longitud > -79.0 && $longitud < -78.0);
            $esAmazonia = $longitud > -77.5;
        }

        $tempDefecto = 24.5;
        $humDefecto = 76.0;
        $precipDefecto = 1100.0;
        $phDefecto = 6.2;

        if ($esSierra) {
            // Gradiente térmico: disminuye la temp con la altitud
            $tempDefecto = $altitud !== null ? max(7.0, min(18.0, 20.0 - ($altitud - 1000) * 0.0045)) : 14.5;
            $humDefecto = 72.0;
            $precipDefecto = 900.0;
            $phDefecto = 5.8;
        } elseif ($esAmazonia) {
            $tempDefecto = 24.0;
            $humDefecto = 85.0;
            $precipDefecto = 2600.0;
            $phDefecto = 5.5;
        }

        $datosClimaYSuelo = [
            'success' => false,
            'source' => 'Simulado/Por Defecto',
            'clima' => [
                'temperatura' => $tempDefecto,
                'humedad' => $humDefecto,
                'precipitacion' => $precipDefecto,
                'viento' => 12.0,
                'temperatura_suelo' => $tempDefecto - 1.2,
            ],
            'suelo' => [
                'ph' => $phDefecto,
                'materia_organica' => $esSierra ? 3.5 : ($esAmazonia ? 4.5 : 2.2),
                'clay' => $esSierra ? 25.0 : ($esAmazonia ? 35.0 : 30.0),
                'sand' => $esSierra ? 45.0 : ($esAmazonia ? 25.0 : 40.0),
                'silt' => $esSierra ? 30.0 : ($esAmazonia ? 40.0 : 30.0)
            ]
        ];

        // API de Open-Meteo — Promedio histórico de los últimos 30 días
        // Se usa /v1/archive en lugar de /v1/forecast para obtener la temperatura
        // MEDIA del ciclo agrícola en vez del valor instantáneo (que varía hora a hora).
        $fechaFin   = date('Y-m-d');
        $fechaInicio = date('Y-m-d', strtotime('-30 days'));
        $urlClima = "https://archive-api.open-meteo.com/v1/archive"
            . "?latitude={$latitud}&longitude={$longitud}"
            . "&start_date={$fechaInicio}&end_date={$fechaFin}"
            . "&daily=temperature_2m_mean,temperature_2m_min,temperature_2m_max"
            .         ",precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max"
            . "&timezone=auto";

        $ch = curl_init($urlClima);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT      => 'AgroPredict/2.0'
        ]);
        $respuestaClima = curl_exec($ch);
        curl_close($ch);

        if ($respuestaClima) {
            $jsonClima = json_decode($respuestaClima, true);
            if ($jsonClima && isset($jsonClima['daily'])) {
                $datosDiarios = $jsonClima['daily'];

                // --- Temperatura media: promedio de los últimos 30 días ---
                $temperaturasMedias = array_filter($datosDiarios['temperature_2m_mean'] ?? [], fn($v) => $v !== null);
                $temperaturasMinimas  = array_filter($datosDiarios['temperature_2m_min']  ?? [], fn($v) => $v !== null);
                if (!empty($temperaturasMedias)) {
                    $datosClimaYSuelo['clima']['temperatura'] = round(array_sum($temperaturasMedias) / count($temperaturasMedias), 1);
                }
                if (!empty($temperaturasMinimas)) {
                    $datosClimaYSuelo['clima']['temperatura_suelo'] = round(array_sum($temperaturasMinimas) / count($temperaturasMinimas) - 0.5, 1);
                } else {
                    $datosClimaYSuelo['clima']['temperatura_suelo'] = $datosClimaYSuelo['clima']['temperatura'] - 1.5;
                }

                // --- Humedad media ---
                $valoresHumedad = array_filter($datosDiarios['relative_humidity_2m_mean'] ?? [], fn($v) => $v !== null);
                if (!empty($valoresHumedad)) {
                    $datosClimaYSuelo['clima']['humedad'] = round(array_sum($valoresHumedad) / count($valoresHumedad), 1);
                }

                // --- Precipitación: suma real de los 30 días, escalada a mm/año ---
                $valoresPrecip = array_filter($datosDiarios['precipitation_sum'] ?? [], fn($v) => $v !== null);
                if (!empty($valoresPrecip)) {
                    $precipTotal30d = array_sum($valoresPrecip);          // mm en 30 días
                    $precipAnualEstimada = round($precipTotal30d * 12.0, 1);   // proyección anual
                    // Clamp a rango agronómico razonable (200–3500 mm/año)
                    $datosClimaYSuelo['clima']['precipitacion'] = max(200.0, min(3500.0, $precipAnualEstimada));
                }

                // --- Viento ---
                $valoresViento = array_filter($datosDiarios['wind_speed_10m_max'] ?? [], fn($v) => $v !== null);
                if (!empty($valoresViento)) {
                    $datosClimaYSuelo['clima']['viento'] = round(array_sum($valoresViento) / count($valoresViento), 1);
                }

                $datosClimaYSuelo['success'] = true;
                $datosClimaYSuelo['source']  = 'Open-Meteo Archive API (Promedio 30 dias)';
            }
        }

        // API de SoilGrids
        $urlSuelo = "https://rest.isric.org/soilgrids/v2.0/properties/query?lon={$longitud}&lat={$latitud}&property=phh2o&property=clay&property=sand&property=silt&property=soc&depth=0-5cm&value=mean";
        $ch = curl_init($urlSuelo);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 3,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_USERAGENT      => 'AgroPredict/2.0'
        ]);
        $respuestaSuelo = curl_exec($ch);
        curl_close($ch);

        if ($respuestaSuelo) {
            $jsonSuelo = json_decode($respuestaSuelo, true);
            if ($jsonSuelo && isset($jsonSuelo['properties']['layers'])) {
                $capasSuelo = $jsonSuelo['properties']['layers'];
                $datosSueloTemp = [];
                foreach ($capasSuelo as $capa) {
                    $nombreCapa = $capa['name'];
                    if (isset($capa['depths'][0]['values']['mean'])) {
                        $datosSueloTemp[$nombreCapa] = floatval($capa['depths'][0]['values']['mean']);
                    }
                }

                if (isset($datosSueloTemp['phh2o'])) {
                    $datosClimaYSuelo['suelo']['ph'] = round($datosSueloTemp['phh2o'] / 10.0, 1);
                }
                if (isset($datosSueloTemp['clay'])) {
                    $datosClimaYSuelo['suelo']['clay'] = round($datosSueloTemp['clay'] / 10.0, 1);
                }
                if (isset($datosSueloTemp['sand'])) {
                    $datosClimaYSuelo['suelo']['sand'] = round($datosSueloTemp['sand'] / 10.0, 1);
                }
                if (isset($datosSueloTemp['silt'])) {
                    $datosClimaYSuelo['suelo']['silt'] = round($datosSueloTemp['silt'] / 10.0, 1);
                }
                if (isset($datosSueloTemp['soc'])) {
                    $soc_pct = $datosSueloTemp['soc'] / 100.0;
                    $datosClimaYSuelo['suelo']['materia_organica'] = round($soc_pct * 1.724, 2);
                }
                $datosClimaYSuelo['success'] = true;
                if ($datosClimaYSuelo['source'] === 'Open-Meteo API') {
                    $datosClimaYSuelo['source'] = 'Open-Meteo & SoilGrids APIs (Tiempo real)';
                } else {
                    $datosClimaYSuelo['source'] = 'SoilGrids API (Tiempo real)';
                }
            }
        }

        if ($datosClimaYSuelo['success']) {
            @file_put_contents($archivoCache, json_encode($datosClimaYSuelo));
        }

        return $datosClimaYSuelo;
    }

    public function index(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->obtenerUsuarioAutenticadoOError();

        $cultivoId = isset($_GET['cultivo_id']) && $_GET['cultivo_id'] !== '' ? intval($_GET['cultivo_id']) : null;
        $cultivoSeleccionado = null;

        if ($cultivoId) {
            $cultivoSeleccionado = $this->cultivo->obtenerPorId($cultivoId);
            if (!$cultivoSeleccionado || $cultivoSeleccionado['usuario_id'] != $usuarioId) {
                http_response_code(403);
                echo json_encode(['error' => 'Esta parcela no es válida o no está registrada a tu nombre.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        // Si no hay un cultivo seleccionado, no hay datos geoespaciales para analizar
        if (!$cultivoSeleccionado) {
            $totalCultivos = $this->cultivo->contarPorUsuario($usuarioId);
            echo json_encode(['sin_datos' => true, 'total_cultivos' => $totalCultivos], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $temperaturaPromedio = 24.5;
        $humedadPromedio = 65.0;
        $precipitacionPromedio = 800.0;
        $fuenteApi = 'Simulado/Histórico';
        $sueloInfo = null;
        $informacionApi = null;

        if ($cultivoSeleccionado && !empty($cultivoSeleccionado['latitud']) && !empty($cultivoSeleccionado['longitud'])) {
            $altitud = !empty($cultivoSeleccionado['altitud']) ? floatval($cultivoSeleccionado['altitud']) : null;
            $informacionApi = $this->consultarDatosApiPrecision(floatval($cultivoSeleccionado['latitud']), floatval($cultivoSeleccionado['longitud']), $altitud);
            if ($informacionApi['success']) {
                $temperaturaPromedio = $informacionApi['clima']['temperatura'];
                $humedadPromedio = $informacionApi['clima']['humedad'];
                $precipitacionPromedio = $informacionApi['clima']['precipitacion'];
                $fuenteApi = $informacionApi['source'];
                $sueloInfo = $informacionApi['suelo'];
            }
        }

        // El estado del ENSO es un fenómeno global macro-climático. No varía por lote localmente.
        // Lo definimos globalmente para todo el país según el año seleccionado.
        $year = isset($_GET['anio']) && $_GET['anio'] !== '' ? intval($_GET['anio']) : 2026;

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

        if ($cultivoSeleccionado && !empty($cultivoSeleccionado['latitud'])) {
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

        if ($cultivoSeleccionado && !empty($cultivoSeleccionado['fecha_siembra'])) {
            $fechaSiembraObj = new DateTime($cultivoSeleccionado['fecha_siembra']);
            $meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            
            // Emergencia (0-15 días)
            $emergenciaMes = $meses[intval($fechaSiembraObj->format('m')) - 1];
            
            // Crecimiento (V3-V12: 15-60 días)
            $fechaCrecimiento = clone $fechaSiembraObj;
            $fechaCrecimiento->modify('+1 month');
            $crecimientoMes = $meses[intval($fechaCrecimiento->format('m')) - 1];
            
            // Floración (VT-R1: 60-80 días)
            $fechaFloracion = clone $fechaSiembraObj;
            $fechaFloracion->modify('+2 months');
            $floracionMes = $meses[intval($fechaFloracion->format('m')) - 1];
            
            // Llenado (R2-R5: 80-110 días)
            $fechaLlenado = clone $fechaSiembraObj;
            $fechaLlenado->modify('+3 months');
            $llenadoMes = $meses[intval($fechaLlenado->format('m')) - 1];
        } else {
            // Temporada por defecto de la Sierra
            $emergenciaMes = 'Oct-Nov';
            $crecimientoMes = 'Nov-Dic';
            $floracionMes = 'Ene-Feb';
            $llenadoMes = 'Mar-Abr';
        }

        // Cargar datos agronomia de JSON
        $rutaJson = __DIR__ . '/../data/agronomia_data.json';
        $datosAgronomia = [];
        if (file_exists($rutaJson)) {
            $datosAgronomia = json_decode(file_get_contents($rutaJson), true);
        }

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

        // Buscar condiciones agronómicas correspondientes
        $condicionesEncontradas = null;
        foreach (($datosAgronomia['condiciones_agronomicas'] ?? []) as $cond) {
            if (strpos(strtolower($cond['Zona'] ?? ''), strtolower($zonaEcuador)) !== false) {
                $condicionesEncontradas = $cond;
                break;
            }
        }
        
        // Buscar fertilización correspondiente
        $fertilizacionEncontrada = null;
        $palabraClaveZonaFert = $esSierra ? 'Sierra' : 'Costa';
        foreach (($datosAgronomia['fertilizacion'] ?? []) as $fert) {
            if (strpos(strtolower($fert['Zona'] ?? ''), strtolower($palabraClaveZonaFert)) !== false) {
                $fertilizacionEncontrada = $fert;
                break;
            }
        }
        
        // Extraer valores
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
                // Filtro de región
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
                
                // Filtro de etapa
                $etapa = strtolower($p['Etapa Crítica'] ?? '');
                $match_stage = false;
                if ($nombreEtapa === 'Emergencia') {
                    if (strpos($etapa, 'emergencia') !== false || strpos($etapa, '0–15') !== false || strpos($etapa, 'v1') !== false) {
                        $match_stage = true;
                    }
                } elseif ($nombreEtapa === 'Crecimiento') {
                    if (strpos($etapa, 'v2') !== false || strpos($etapa, 'v3') !== false || strpos($etapa, 'v4') !== false || strpos($etapa, 'v6') !== false || strpos($etapa, 'v8') !== false || strpos($etapa, 'vegetativo') !== false) {
                        $match_stage = true;
                    }
                } elseif ($nombreEtapa === 'Floración') {
                    if (strpos($etapa, 'r1') !== false || strpos($etapa, 'r2') !== false || strpos($etapa, 'floración') !== false || strpos($etapa, 'seda') !== false) {
                        $match_stage = true;
                    }
                } elseif ($nombreEtapa === 'Llenado de grano') {
                    if (strpos($etapa, 'r3') !== false || strpos($etapa, 'r4') !== false || strpos($etapa, 'llenado') !== false || strpos($etapa, 'grano') !== false) {
                        $match_stage = true;
                    }
                }
                
                if ($match_stage) {
                    $name = $p['Nombre Común'] ?? 'Plaga';
                    $umbral = str_replace("\n", " ", $p['Umbral\nAcción'] ?? $p['Umbral Acción'] ?? 'Monitoreo');
                    $control = str_replace("\n", " ", $p['Control Químico'] ?? 'N/A');
                    $coincidencias[] = "{$name} (Umbral: {$umbral}; Control: {$control})";
                }
            }
            if (empty($coincidencias)) {
                return "No se registran plagas de alta incidencia.";
            }
            return "Plagas clave: " . implode(" | ", $coincidencias);
        };

        $lineaTiempoFenologica = [
            [
                'etapa' => 'Emergencia',
                'mes' => $emergenciaMes,
                'riesgo' => 'Bajo Riesgo',
                'alerta' => 'Bajo',
                'color' => 'success',
                'descripcion' => "Suelo: {$tipo_suelo} (pH óptimo: {$ph_optimo}). Densidad objetivo: {$densidad} pl/ha. Riego: {$riego}. " . $generarTextoPlagas('Emergencia')
            ],
            [
                'etapa' => 'Crecimiento',
                'mes' => $crecimientoMes,
                'riesgo' => 'Riesgo Moderado',
                'alerta' => 'Moderado',
                'color' => 'warning',
                'descripcion' => "Fertilización recomendada: {$nitrogeno} kg/ha de N. Fraccionamiento: {$fraccionamiento}. Biofertilización: {$biofertilizante}. " . $generarTextoPlagas('Crecimiento')
            ],
            [
                'etapa' => 'Floración',
                'mes' => $floracionMes,
                'riesgo' => 'Alto Riesgo',
                'alerta' => 'Alto',
                'color' => 'danger',
                'descripcion' => "Temperatura óptima de desarrollo: {$temp_optima} °C. Evitar encharcamientos o sequías extremas durante polinización. " . $generarTextoPlagas('Floración')
            ],
            [
                'etapa' => 'Llenado de grano',
                'mes' => $llenadoMes,
                'riesgo' => 'Riesgo Moderado',
                'alerta' => 'Moderado',
                'color' => 'warning',
                'descripcion' => "Duración estimada del ciclo en esta zona: {$ciclo_dias} días. Mantener humedad residual. " . $generarTextoPlagas('Llenado de grano')
            ]
        ];


        echo json_encode([
            'kpis' => [
                'enso' => [
                    'estado' => $ensoEstado,
                    'color' => $ensoColor,
                    'desc' => $ensoDesc
                ],
                'prob_lluvia_bajo_promedio' => $probLluviaBaja,
                'prob_estres_termico' => $probEstrTermico,
                'agua_util' => $aguaUtil,
                'indice_riesgo' => [
                    'nivel' => $indiceRiesgoClima,
                    'color' => $indiceRiesgoColor
                ]
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
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
