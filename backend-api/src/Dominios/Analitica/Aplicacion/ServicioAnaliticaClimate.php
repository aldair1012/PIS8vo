<?php
// src/Dominios/Analitica/Aplicacion/ServicioAnaliticaClimate.php — Servicio que construye los datos del dashboard Climate.
// Conserva datos externos con procedencia; los indicadores no estimables permanecen null.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioClimaActual;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

class ServicioAnaliticaClimate
{
    public function __construct(
        private CatalogoAgronomicoInterface $catalogo,
        private CultivoRepositoryInterface $cultivos,
        private ServicioDatosTerreno $terreno,
        private ServicioClimaActual $climaActual,
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId = null, ?int $año = null): array
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

        $temperaturaPromedio = null;
        $humedadPromedio = null;
        $precipitacionPromedio = null;
        $precipitacion30d = null;
        $fuenteApi = 'No disponible';
        $sueloInfo = null;
        $climaHoy = null;
        $pronostico7d = [];

        $tieneCoordenadas = $this->numero($cultivoSeleccionado['latitud'] ?? null, -90, 90) !== null
            && $this->numero($cultivoSeleccionado['longitud'] ?? null, -180, 180) !== null;
        if ($tieneCoordenadas) {
            $altitud = isset($cultivoSeleccionado['altitud']) && $cultivoSeleccionado['altitud'] !== ''
                ? (float) $cultivoSeleccionado['altitud']
                : null;
            try {
                $informacionApi = $this->terreno->obtener(
                    (float) $cultivoSeleccionado['latitud'], (float) $cultivoSeleccionado['longitud'], $altitud
                );
            } catch (\Throwable) {
                $informacionApi = [];
            }
            // El proveedor puede devolver un bloque parcial mezclado con respaldo.
            // Solo publicar campos cuyo origen API esté registrado individualmente.
            $camposClima = is_array($informacionApi['clima_campos_api'] ?? null) ? $informacionApi['clima_campos_api'] : [];
            $clima = is_array($informacionApi['clima'] ?? null) ? $informacionApi['clima'] : [];
            if ($informacionApi['clima_disponible_api'] ?? false) {
                $temperaturaPromedio = in_array('temperatura', $camposClima, true) ? $this->numero($clima['temperatura'] ?? null) : null;
                $humedadPromedio = in_array('humedad', $camposClima, true) ? $this->numero($clima['humedad'] ?? null, 0, 100) : null;
                $precipitacionPromedio = in_array('precipitacion', $camposClima, true) ? $this->numero($clima['precipitacion'] ?? null, 0) : null;
                $precipitacion30d = in_array('precipitacion_30d', $camposClima, true) ? $this->numero($clima['precipitacion_30d'] ?? null, 0) : null;
            }
            if ($informacionApi['exito'] ?? false) {
                $fuenteApi = (string) ($informacionApi['source'] ?? 'Proveedor externo');
            }
            if ($informacionApi['suelo_disponible_api'] ?? false) {
                $camposSuelo = is_array($informacionApi['suelo_campos_api'] ?? null) ? $informacionApi['suelo_campos_api'] : [];
                $sueloInfo = array_intersect_key($informacionApi['suelo'] ?? [], array_flip($camposSuelo));
            }

            // El clima actual es una observación/pronóstico de corto plazo.
            // Se mantiene separado del promedio de 30 días para no mezclar
            // una condición de hoy con la climatología del ciclo.
            try {
                $climaConsulta = $this->climaActual->obtener(
                    floatval($cultivoSeleccionado['latitud']),
                    floatval($cultivoSeleccionado['longitud']),
                    $altitud,
                );
                $climaHoy = $climaConsulta;
                if (($climaConsulta['disponible'] ?? false) === true) {
                    $pronostico7d = is_array($climaConsulta['pronostico_7d'] ?? null)
                        ? $climaConsulta['pronostico_7d']
                        : [];
                }
            } catch (\Throwable) {
                // La indisponibilidad no debe impedir mostrar los otros bloques.
            }
        }

        $lluviaAnual = $this->terreno->referenciaLluvia($cultivoSeleccionado);
        $precipitacionPromedio = $lluviaAnual['valor'] ?? null;
        $year = $año ?? (int) date('Y');

        $ensoEstado = null;
        $ensoColor = 'info';
        $ensoDesc = "No disponible: ZeaSys no tiene integrada una fuente ENSO para {$year}.";
        $probLluviaBaja = null;
        $probEstrTermico = null;
        $aguaUtil = null;
        $indiceRiesgoClima = null;
        $indiceRiesgoColor = 'info';
        $etiquetasMeses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        $anomaliaLluvia = $anomaliaTemp = $promedioHistLluvia = array_fill(0, 12, null);
        $aguaPorEstrato = array_fill(0, 4, null);

        $emergenciaMes = $crecimientoMes = $floracionMes = $llenadoMes = 'No disponible';
        $fechaSiembra = $this->fechaValida($cultivoSeleccionado['fecha_siembra'] ?? null);
        if ($fechaSiembra !== null) {
            $mesSiembra = new \DateTimeImmutable($fechaSiembra);
            $mesSiembra = $mesSiembra->modify('first day of this month');
            $mesesEtapas = [];
            for ($i = 0; $i < 4; $i++) {
                $mesesEtapas[] = $etiquetasMeses[(int) $mesSiembra->modify("+{$i} months")->format('m') - 1];
            }
            [$emergenciaMes, $crecimientoMes, $floracionMes, $llenadoMes] = $mesesEtapas;
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

        $temp_optima = $condicionesEncontradas['Temperatura Óptima (°C)'] ?? 'No disponible';
        $ph_optimo = $condicionesEncontradas['pH Óptimo'] ?? 'No disponible';
        $tipo_suelo = $condicionesEncontradas['Tipo de Suelo'] ?? 'No disponible';
        $densidad = $condicionesEncontradas['Densidad (pl/ha)'] ?? 'No disponible';
        $riego = $condicionesEncontradas['Riego'] ?? 'No disponible';
        $ciclo_dias = $condicionesEncontradas['Ciclo (días)'] ?? 'No disponible';

        $nitrogeno = $fertilizacionEncontrada['Nitrógeno N (kg/ha)'] ?? 'No disponible';
        $fraccionamiento = $fertilizacionEncontrada['Fraccionamiento N'] ?? 'No disponible';
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
            if (empty($coincidencias)) { return "Sin fichas coincidentes; no hay observaciones de incidencia de esta parcela."; }
            return "Referencias de monitoreo del catálogo (no incidencia observada): " . implode(" | ", $coincidencias);
        };

        $lineaTiempoFenologica = [
            ['etapa' => 'Emergencia','mes' => $emergenciaMes,'riesgo' => 'No evaluado','alerta' => 'Sin evaluación','color' => 'info','descripcion' => "Suelo: {$tipo_suelo} (pH óptimo: {$ph_optimo}). Densidad objetivo: {$densidad} pl/ha. Riego: {$riego}. " . $generarTextoPlagas('Emergencia')],
            ['etapa' => 'Crecimiento','mes' => $crecimientoMes,'riesgo' => 'No evaluado','alerta' => 'Sin evaluación','color' => 'info','descripcion' => "Fertilización recomendada: {$nitrogeno} kg/ha de N. Fraccionamiento: {$fraccionamiento}. Biofertilización: {$biofertilizante}. " . $generarTextoPlagas('Crecimiento')],
            ['etapa' => 'Floración','mes' => $floracionMes,'riesgo' => 'No evaluado','alerta' => 'Sin evaluación','color' => 'info','descripcion' => "Temperatura óptima de desarrollo: {$temp_optima} °C. Evitar encharcamientos o sequías extremas durante polinización. " . $generarTextoPlagas('Floración')],
            ['etapa' => 'Llenado de grano','mes' => $llenadoMes,'riesgo' => 'No evaluado','alerta' => 'Sin evaluación','color' => 'info','descripcion' => "Duración estimada del ciclo en esta zona: {$ciclo_dias} días. Mantener humedad residual. " . $generarTextoPlagas('Llenado de grano')]
        ];

        foreach ($lineaTiempoFenologica as &$etapa) {
            $etapa['tipo'] = 'referencia_fenologica_no_observada';
            $etapa['estado'] = 'no_evaluado';
            $etapa['fuente'] = 'Catálogo agronómico local; meses orientativos desde la siembra registrada';
        }
        unset($etapa);

        return [
            'procedencia' => [
                'clima' => ['tipo' => 'modelo_reanalisis', 'fuente' => $fuenteApi, 'campos_api' => $camposClima ?? [],
                    'nota' => 'Promedios y acumulados del proveedor; no son mediciones del lote. Campos ausentes permanecen null.'],
                'riesgo' => ['estado' => 'no_disponible', 'motivo' => 'No hay un modelo probabilístico calibrado para riesgo de sequía o estrés térmico.'],
                'agua_util' => ['estado' => 'no_disponible', 'motivo' => 'Textura, lluvia y humedad relativa no permiten medir agua útil actual ni repartirla por profundidad.'],
                'anomalias' => ['estado' => 'no_disponible', 'motivo' => 'Falta una serie mensual del año solicitado y una climatología comparable.'],
            ],
            'kpis' => [
                'enso' => ['estado' => $ensoEstado,'color' => $ensoColor,'desc' => $ensoDesc],
                'prob_lluvia_bajo_promedio' => $probLluviaBaja,
                'prob_estres_termico' => $probEstrTermico,
                'agua_util' => $aguaUtil,
                'indice_riesgo' => ['nivel' => $indiceRiesgoClima,'color' => $indiceRiesgoColor,'estado' => 'no_disponible']
            ],
            'api_source' => $fuenteApi,
            'lluvia_anual_referencia' => $lluviaAnual,
            'periodo_clima_reciente' => $informacionApi['clima']['periodo_30d'] ?? null,
            // Se conserva clima_actual por compatibilidad con consumidores
            // anteriores, pero ahora declara explícitamente que es un promedio.
            'clima_actual' => [
                'disponible' => $temperaturaPromedio !== null || $humedadPromedio !== null || $precipitacion30d !== null,
                'temperatura' => $temperaturaPromedio,
                'humedad' => $humedadPromedio,
                'precipitacion' => $precipitacionPromedio,
                'precipitacion_anual_estimada' => $precipitacionPromedio,
                'precipitacion_30d' => $precipitacion30d,
                'periodo' => 'promedio_30_dias',
                'nota_precipitacion' => 'Temperatura y humedad: promedio de 30 dias. Lluvia anual: promedio histórico por ubicación; precipitacion_30d es el acumulado de treinta días completos disponibles.',
                'nota' => 'Promedio de los últimos 30 días; no es el clima de hoy ni un pronóstico.'
            ],
            'clima_promedio_30d' => [
                'disponible' => $temperaturaPromedio !== null || $humedadPromedio !== null || $precipitacion30d !== null,
                'temperatura' => $temperaturaPromedio,
                'humedad' => $humedadPromedio,
                'precipitacion' => $precipitacionPromedio,
                'precipitacion_anual_estimada' => $precipitacionPromedio,
                'precipitacion_30d' => $precipitacion30d,
                'nota_precipitacion' => 'Lluvia anual: referencia histórica independiente del acumulado de treinta días.',
                'fuente' => $fuenteApi
            ],
            'clima_hoy' => $climaHoy,
            'pronostico_7d' => $pronostico7d,
            'suelo' => $sueloInfo ? [
                'ph' => $sueloInfo['ph'] ?? null,
                'materia_organica_pct' => $sueloInfo['materia_organica'] ?? null,
                'arcilla_pct' => $sueloInfo['clay'] ?? null,
                'limo_pct' => $sueloInfo['silt'] ?? null,
                'arena_pct' => $sueloInfo['sand'] ?? null,
            ] : null,
            'nutricion' => [
                'zona' => $zonaEcuador,
                'ph_suelo' => $sueloInfo['ph'] ?? ($cultivoSeleccionado['ph'] ?? null),
                'materia_organica_pct' => $sueloInfo['materia_organica'] ?? null,
                'ph_optimo' => $ph_optimo,
                'nitrogeno_recomendado_kg_ha' => $nitrogeno,
                'fraccionamiento_n' => $fraccionamiento,
                'biofertilizante' => $biofertilizante,
                'fertilizacion_registrada' => [
                    'fecha' => $cultivoSeleccionado['fertilizacion_fecha'] ?? null,
                    'dosis' => $cultivoSeleccionado['fertilizacion_dosis'] ?? null,
                    'tipo' => $cultivoSeleccionado['fertilizacion_tipo'] ?? null,
                ],
                'nota' => 'Recomendación de catálogo; no sustituye un análisis de suelo. No prescribir dosis de P, K o micronutrientes sin análisis.',
            ],
            'timeline_anomalia' => [
                'labels' => $etiquetasMeses,
                'estado' => 'no_disponible',
                'motivo' => 'Sin serie mensual y climatología comparable; no se generan curvas sintéticas.',
                'lluvia_historica' => $promedioHistLluvia,
                'lluvia_anomala' => $anomaliaLluvia,
                'temperatura_anomala' => $anomaliaTemp
            ],
            'agua_estratos' => [
                'labels' => ['0-20 cm', '20-40 cm', '40-60 cm', '60-100 cm'],
                'valores' => $aguaPorEstrato,
                'estado' => 'no_disponible',
                'motivo' => 'Faltan mediciones de humedad, capacidad de campo, marchitez y profundidad efectiva.'
            ],
            'timeline_fenologico' => $lineaTiempoFenologica,
            'fecha_siembra' => $fechaSiembra
        ];
    }

    private function numero(mixed $valor, ?float $minimo = null, ?float $maximo = null): ?float
    {
        if (is_bool($valor) || !is_numeric($valor)) return null;
        $numero = (float) $valor;
        return is_finite($numero) && ($minimo === null || $numero >= $minimo) && ($maximo === null || $numero <= $maximo) ? $numero : null;
    }

    private function fechaValida(mixed $valor): ?string
    {
        if (!is_string($valor)) return null;
        $fecha = \DateTimeImmutable::createFromFormat('!Y-m-d', $valor);
        return $fecha !== false && $fecha->format('Y-m-d') === $valor ? $valor : null;
    }
}
