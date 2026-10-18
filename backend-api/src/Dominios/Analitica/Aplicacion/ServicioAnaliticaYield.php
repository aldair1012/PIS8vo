<?php
// src/Dominios/Analitica/Aplicacion/ServicioAnaliticaYield.php — Servicio que construye los datos del dashboard Yield.
// Dependencias inyectadas: catálogo, parcelas, simulaciones y datos de terreno compartidos con Climate.
// Las variaciones ilustrativas son deterministas por parcela/año para evitar saltos entre recargas.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

class ServicioAnaliticaYield
{
    public function __construct(
        private CatalogoAgronomicoInterface $catalogo,
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones,
        private ServicioDatosTerreno $terreno
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId = null, ?int $anio = null): array
    {
        $agronomiaData = $this->catalogo->cargar();

        $selectedCultivo = null;
        if ($cultivoId) {
            $selectedCultivo = $this->cultivos->obtenerPorId($cultivoId);
            if (!$selectedCultivo || (int) $selectedCultivo['usuario_id'] !== $usuarioId) {
                throw new AccesoDenegadoException('Esta parcela no es válida o no está registrada a tu nombre.');
            }
        }

        $recientes = $this->simulaciones->obtenerRecientes($usuarioId, 50, $anio);

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

        $avgRend = 0; $avgTemp = 0; $avgFert = 0; $avgPh = 0; $avgPrec = 0; $avgHum = 0;
        $rendimientos = [];
        $categoriasCosecha = [];
        $probabilidadesModelo = [];
        $tipoSueloSimulado = null;

        foreach ($recientes as $sim) {
            $r = floatval($sim['rendimiento_estimado'] ?? 0);
            $rendimientos[] = $r;
            $avgRend += $r;
            $avgTemp += floatval($sim['temperatura'] ?? 0);
            $avgFert += floatval($sim['fertilizante'] ?? 0);
            $avgPh   += floatval($sim['ph_suelo'] ?? 0);
            $avgPrec += floatval($sim['precipitacion'] ?? 0);
            $avgHum  += floatval($sim['humedad'] ?? 0);
            if (!empty($sim['categoria_cosecha'])) {
                $categoriasCosecha[] = strtolower(trim((string) $sim['categoria_cosecha']));
            }
            // Las simulaciones nuevas guardan la probabilidad del clasificador
            // dentro de escenarios_json. Se ignoran registros corruptos o
            // antiguos que no tengan ese bloque.
            $escenariosGuardados = json_decode((string) ($sim['escenarios_json'] ?? ''), true);
            $probabilidadGuardada = is_array($escenariosGuardados)
                ? $this->numeroFinito($escenariosGuardados['_zeasys_modelo']['probabilidad_cosecha'] ?? null)
                : null;
            if ($probabilidadGuardada !== null) {
                $probabilidadesModelo[] = $this->limitar($probabilidadGuardada, 0, 100);
            }
            if ($tipoSueloSimulado === null && !empty($sim['tipo_suelo'])) {
                $tipoSueloSimulado = strtolower(trim((string) $sim['tipo_suelo']));
            }
        }
        $avgRend = round($avgRend / $simCount, 2);
        $avgTemp = round($avgTemp / $simCount, 1);
        $avgFert = round($avgFert / $simCount, 0);
        $avgPh   = round($avgPh / $simCount, 1);
        $avgPrec = round($avgPrec / $simCount, 0);
        $avgHum  = round($avgHum / $simCount, 1);

        $variedad_maiz = 'Pioneer P4039';
        $isSierra = false;
        if ($selectedCultivo) {
            $variedad_maiz = $selectedCultivo['variedad_maiz'] ?? 'Pioneer P4039';
            $alt = floatval($selectedCultivo['altitud'] ?? 45.0);
            $lng = floatval($selectedCultivo['longitud'] ?? -78.5);
            $isSierra = $alt > 1000 || ($lng > -79.0 && $lng < -78.0);
        }

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

        // Datos de terreno compartidos con Climate. Si no hay coordenadas o una API
        // externa no responde, se conservan valores estimados locales y se informa la
        // procedencia en kpi_fuentes; nunca se presenta un fallback como medición real.
        $datosTerreno = null;
        $fuenteTerreno = 'Estimación local por zona y tipo de suelo';
        $tieneCoordenadas = $selectedCultivo
            && isset($selectedCultivo['latitud'], $selectedCultivo['longitud'])
            && $selectedCultivo['latitud'] !== ''
            && $selectedCultivo['longitud'] !== '';
        if ($tieneCoordenadas) {
            try {
                $datosTerreno = $this->terreno->obtener(
                    (float) $selectedCultivo['latitud'],
                    (float) $selectedCultivo['longitud'],
                    isset($selectedCultivo['altitud']) && $selectedCultivo['altitud'] !== ''
                        ? (float) $selectedCultivo['altitud']
                        : null
                );
                if (!empty($datosTerreno['success'])) {
                    $fuenteTerreno = (string) ($datosTerreno['source'] ?? 'APIs de clima y suelo');
                }
            } catch (\Throwable) {
                // El dashboard sigue siendo útil aunque Open-Meteo/SoilGrids estén
                // temporalmente fuera de servicio.
                $datosTerreno = null;
            }
        }

        $sueloTerreno = is_array($datosTerreno['suelo'] ?? null) ? $datosTerreno['suelo'] : [];
        $climaTerreno = is_array($datosTerreno['clima'] ?? null) ? $datosTerreno['clima'] : [];
        $tipoSuelo = $this->normalizarTipoSuelo(
            $selectedCultivo['tipo_suelo'] ?? $tipoSueloSimulado,
            $sueloTerreno
        );
        if ($tipoSuelo === null) {
            $tipoSuelo = 'Franco';
        }
        $tipoSueloClave = strtolower((string) ($tipoSuelo ?? ''));
        $aguaUtil = $this->calcularAguaUtil($sueloTerreno, $climaTerreno, $avgPrec, $avgHum, $tipoSueloClave);
        $fuenteAgua = !empty($sueloTerreno)
            ? $fuenteTerreno . ' + textura del suelo'
            : 'Estimación local por precipitación, humedad y tipo de suelo';
        $fuenteTipoSuelo = !empty($selectedCultivo['tipo_suelo'])
            ? 'Tipo de suelo registrado en la parcela'
            : (!empty($tipoSueloSimulado)
                ? 'Tipo de suelo ingresado en las simulaciones'
                : (!empty($sueloTerreno)
                    ? $fuenteTerreno . ' + clasificación de textura'
                    : 'Valor teórico de referencia para suelo sin análisis local'));

        $radiacionPar = $this->numeroFinito($climaTerreno['radiacion_par'] ?? null);
        if ($radiacionPar === null) {
            $radiacionPar = $this->estimarRadiacionPar($isSierra, $avgHum, $avgPrec);
            $fuenteRadiacion = 'Estimación local por zona y nubosidad';
        } else {
            $fuenteRadiacion = 'Open-Meteo Archive API (radiación solar de los últimos 30 días)';
        }

        // Usar la probabilidad del clasificador ML guardada en cada simulación.
        // Para registros antiguos sólo existe la categoría, por lo que se
        // mantiene un puntaje de compatibilidad claramente etiquetado como
        // legado y no se mezcla con confianza (R²) ni con rendimiento.
        $categoriaScore = $this->puntajeCategoriaCosecha($categoriasCosecha);
        $coberturaAlcanzable = $rendAlcanzable > 0
            ? $this->limitar($rendPredicho / $rendAlcanzable * 100, 0, 100)
            : 0;
        if (!empty($probabilidadesModelo)) {
            $probabilidadCosecha = round(array_sum($probabilidadesModelo) / count($probabilidadesModelo), 1);
            $fuenteProbabilidad = 'Probabilidad del clasificador ML guardada en simulaciones';
        } elseif ($categoriaScore !== null) {
            $probabilidadCosecha = $categoriaScore;
            $fuenteProbabilidad = 'Categoría del clasificador ML (simulación antigua sin probabilidades)';
        } else {
            $probabilidadCosecha = 65.0;
            $fuenteProbabilidad = 'Valor teórico de referencia del modelo (categoría Media)';
        }

        // No existe biomasa medida en la tabla actual. Se entrega un HI agronómico
        // estimado según cobertura del rendimiento, no una medición de campo.
        $indiceCosecha = round($this->limitar(0.38 + (0.14 * ($coberturaAlcanzable / 100)), 0.38, 0.52), 2);
        $denominadorGap = max(0.1, $yieldGap);

        $optN = 180.0;
        $optPrec = $isSierra ? 1000.0 : 700.0;
        $optTemp = $isSierra ? 16.0 : 25.0;
        $optPh = 6.0;

        $defN = max(0, $optN - $avgFert);
        $defPrec = abs($optPrec - $avgPrec);
        $defTemp = abs($optTemp - $avgTemp);
        $defPh = abs($optPh - $avgPh);

        $perdidaNitrogeno = round($defN * 0.012, 1);
        $perdidaAgua = round($defPrec * 0.002, 1);
        $perdidaTemp = round($defTemp * 0.15, 1);
        $semilla = implode('|', [$usuarioId, $cultivoId ?? 0, $anio ?? (int) date('Y'), 'fecha-siembra']);
        $perdidaFechaSiembra = round($this->variacionDeterminista($semilla, 2, 6) / 10, 1);
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
        $severidadLimitante = $principalLimitante !== null && $denominadorGap > 0
            ? $this->limitar(($factores[$principalLimitante] / $denominadorGap) * 100, 0, 100)
            : 50.0;
        $faseVulnerable = $this->calcularFaseVulnerable($principalLimitante, $severidadLimitante);

        $mejorAnoHist = $simCount > 0 ? round(max($rendimientos) * 1.1, 1) : 10.5;
        $peorAnoHist = $simCount > 0 ? round(min($rendimientos) * 0.85, 1) : 3.2;

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

        return [
            'cultivo_activo' => $selectedCultivo,
            'kpis' => [
                'rendimiento_potencial' => $rendPotencial,
                'rendimiento_alcanzable' => $rendAlcanzable,
                'rendimiento_predicho' => $rendPredicho,
                'yield_gap_total' => $yieldGap,
                'principal_limitante' => $principalLimitante,
                'tipo_suelo' => $tipoSuelo,
                'fase_vulnerable' => $faseVulnerable['nombre'],
                'fase_vulnerable_riesgo' => $faseVulnerable['riesgo'],
                'agua_util' => $aguaUtil,
                'probabilidad_cosecha' => $probabilidadCosecha,
                'indice_cosecha' => $indiceCosecha,
                'radiacion_par' => $radiacionPar
            ],
            'kpi_fuentes' => [
                'rendimiento_potencial' => 'Catálogo agronómico de la variedad (teórico)',
                'rendimiento_alcanzable' => 'Catálogo agronómico y escenario de la parcela',
                'rendimiento_predicho' => 'Promedio de simulaciones guardadas',
                'yield_gap_total' => 'Calculado con los rendimientos del escenario',
                'tipo_suelo' => $fuenteTipoSuelo,
                'fase_vulnerable' => $faseVulnerable['fuente'],
                'agua_util' => $fuenteAgua,
                'probabilidad_cosecha' => $fuenteProbabilidad,
                'indice_cosecha' => 'Estimación agronómica: no hay biomasa medida en la base actual',
                'radiacion_par' => $fuenteRadiacion
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
                ['factor' => 'Nitrógeno', 'porcentaje' => round(($perdidaNitrogeno / $denominadorGap) * 100, 1)],
                ['factor' => 'Agua', 'porcentaje' => round(($perdidaAgua / $denominadorGap) * 100, 1)],
                ['factor' => 'Temperatura', 'porcentaje' => round(($perdidaTemp / $denominadorGap) * 100, 1)],
                ['factor' => 'Fecha de Siembra', 'porcentaje' => round(($perdidaFechaSiembra / $denominadorGap) * 100, 1)],
                ['factor' => 'Suelo (pH)', 'porcentaje' => round(($perdidaSuelo / $denominadorGap) * 100, 1)]
            ]
        ];
    }

    /**
     * Calcula agua útil (mm) con textura de SoilGrids cuando existe. Los fallbacks
     * son estimaciones explícitas para que el contrato del dashboard sea completo.
     */
    private function normalizarTipoSuelo(mixed $tipo, array $suelo): ?string
    {
        $texto = strtolower(trim((string) ($tipo ?? '')));
        if ($texto !== '') {
            if (str_contains($texto, 'aren')) {
                return 'Arenoso';
            }
            if (str_contains($texto, 'arcill')) {
                return 'Arcilloso';
            }
            if (str_contains($texto, 'franc') || str_contains($texto, 'limos')) {
                return 'Franco';
            }
        }

        $arena = $this->numeroFinito($suelo['sand'] ?? null);
        $arcilla = $this->numeroFinito($suelo['clay'] ?? null);
        if ($arena === null && $arcilla === null) {
            return null;
        }
        if ($arcilla !== null && $arcilla > 35.0 && ($arena === null || $arena <= 50.0)) {
            return 'Arcilloso';
        }
        if ($arena !== null && $arena > 50.0) {
            return 'Arenoso';
        }
        return 'Franco';
    }

    /**
     * Determina la ventana fenológica más sensible usando la limitante
     * calculada. Es un valor teórico agronómico, no una observación de campo.
     * @return array{nombre: string, riesgo: float, fuente: string}
     */
    private function calcularFaseVulnerable(?string $limitante, float $severidad): array
    {
        $clave = strtolower(trim((string) ($limitante ?? '')));
        if (str_contains($clave, 'nitr')) {
            $fase = 'Crecimiento vegetativo (V6–V8)';
        } elseif (str_contains($clave, 'suelo') || str_contains($clave, 'ph')) {
            $fase = 'Establecimiento–V6';
        } else {
            // Agua y temperatura son más críticos alrededor de floración y
            // polinización; también es el escenario teórico de referencia.
            $fase = 'Floración y polinización (VT–R1)';
        }

        $riesgo = round($this->limitar(55.0 + ($severidad * 0.5), 55.0, 95.0), 0);
        return [
            'nombre' => $fase,
            'riesgo' => $riesgo,
            'fuente' => 'Modelo agronómico teórico según limitante y sensibilidad fenológica',
        ];
    }

    private function calcularAguaUtil(array $suelo, array $clima, float $precipitacion, float $humedad, string $tipoSuelo): float
    {
        $arena = $this->numeroFinito($suelo['sand'] ?? null);
        $arcilla = $this->numeroFinito($suelo['clay'] ?? null);
        $limo = $this->numeroFinito($suelo['silt'] ?? null);
        if ($arena !== null && $arcilla !== null && $limo !== null) {
            return round($this->limitar($arena * 0.6 + $arcilla * 1.8 + $limo * 1.2, 30, 200), 0);
        }

        $baseSuelo = match ($tipoSuelo) {
            'arenoso' => 85.0,
            'arcilloso' => 155.0,
            default => 125.0,
        };
        $lluvia = $this->numeroFinito($clima['precipitacion'] ?? null) ?? $precipitacion;
        $humedadBase = $this->numeroFinito($clima['humedad'] ?? null) ?? $humedad;
        $ajusteClima = (($this->limitar($lluvia, 200, 3500) - 800.0) / 800.0) * 12.0
            + (($this->limitar($humedadBase, 20, 100) - 65.0) / 35.0) * 8.0;
        return round($this->limitar($baseSuelo + $ajusteClima, 30, 200), 0);
    }

    private function estimarRadiacionPar(bool $sierra, float $humedad, float $precipitacion): float
    {
        $base = $sierra ? 33.0 : 41.0;
        $nubosidad = $this->limitar(($humedad - 60.0) * 0.08 + max(0.0, $precipitacion - 900.0) / 2500.0, -5.0, 8.0);
        return round($this->limitar($base - $nubosidad, 15.0, 55.0), 1);
    }

    private function puntajeCategoriaCosecha(array $categorias): ?float
    {
        if (empty($categorias)) {
            return null;
        }
        $pesos = ['alta' => 85.0, 'media' => 65.0, 'baja' => 40.0, 'muy baja' => 15.0];
        $valores = array_values(array_filter(array_map(
            static fn(string $categoria): ?float => $pesos[$categoria] ?? null,
            $categorias
        ), static fn(?float $valor): bool => $valor !== null));
        return empty($valores) ? null : round(array_sum($valores) / count($valores), 1);
    }

    private function numeroFinito(mixed $valor): ?float
    {
        if ($valor === null || $valor === '' || !is_numeric($valor)) {
            return null;
        }
        $numero = (float) $valor;
        return is_finite($numero) ? $numero : null;
    }

    private function limitar(float $valor, float $minimo, float $maximo): float
    {
        return max($minimo, min($maximo, $valor));
    }

    private function variacionDeterminista(string $semilla, int $minimo, int $maximo): int
    {
        $enteroSinSigno = (int) sprintf('%u', crc32($semilla));
        return $minimo + ($enteroSinSigno % ($maximo - $minimo + 1));
    }
}
