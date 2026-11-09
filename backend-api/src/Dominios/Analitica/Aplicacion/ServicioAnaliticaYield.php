<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Analitica\Dominio\ReferenciasRendimientoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

/** Reconstruye los resultados guardados del modelo para una parcela concreta. */
final class ServicioAnaliticaYield
{
    public function __construct(
        private CatalogoAgronomicoInterface $catalogo,
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones,
        private ?ServicioDatosTerreno $terreno = null,
        private ?ReferenciasRendimientoInterface $referencias = null,
        private ?ServicioMedicionesRendimiento $mediciones = null,
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId = null, ?int $año = null): array
    {
        if ($cultivoId === null) {
            return $this->sinDatos('Selecciona una parcela para consultar su proyección.');
        }

        $cultivo = $this->cultivos->obtenerPorId($cultivoId);
        if (!$cultivo || (int) $cultivo['usuario_id'] !== $usuarioId || (isset($cultivo['activo']) && !(bool) $cultivo['activo'])) {
            throw new AccesoDenegadoException('Esta parcela no es válida o no está registrada a tu nombre.');
        }

        // El selector de año del encabezado procede de la fecha del lote. Una
        // simulación puede ejecutarse en otro año; filtrar por s.fecha ocultaba
        // el resultado de parcelas como la que el usuario acaba de simular.
        $registros = $this->simulaciones->obtenerRecientesPorCultivo($usuarioId, $cultivoId, 50, null);
        $muestra = [];
        foreach ($registros as $registro) {
            $rendimiento = $this->numeroNoNegativo($registro['rendimiento_estimado'] ?? null);
            if ($rendimiento === null) {
                continue;
            }

            $area = $this->numeroPositivo($registro['area_simulada'] ?? null);
            $produccionGuardada = $this->numeroNoNegativo($registro['produccion_total'] ?? null);
            $produccion = $produccionGuardada ?? ($area !== null ? round($rendimiento * $area, 2) : null);
            $escenarios = $this->jsonArray($registro['escenarios_json'] ?? null);
            $modelo = is_array($escenarios['_zeasys_modelo'] ?? null) ? $escenarios['_zeasys_modelo'] : [];

            $alternativas = [];
            foreach (['lluvioso', 'verano', 'sequia'] as $nombre) {
                $alternativa = $escenarios[$nombre] ?? null;
                if (!is_array($alternativa)) {
                    continue;
                }
                $valor = $this->numeroNoNegativo($alternativa['rendimiento'] ?? null);
                if ($valor !== null) {
                    $alternativas[$nombre] = [
                        'rendimiento_t_ha' => round($valor, 3),
                        'produccion_total_t' => $this->numeroNoNegativo($alternativa['produccion'] ?? null),
                        'condiciones' => is_array($alternativa['condiciones'] ?? null) ? $alternativa['condiciones'] : null,
                    ];
                }
            }

            $impactos = [];
            foreach ($this->jsonArray($registro['shap_json'] ?? null) as $factor => $valor) {
                $numero = $this->numeroFinito($valor);
                if (is_string($factor) && $numero !== null) {
                    $impactos[$factor] = round($numero, 4);
                }
            }

            $intervalo = is_array($modelo['intervalo_rendimiento'] ?? null) ? $modelo['intervalo_rendimiento'] : [];
            $minimo = $this->numeroNoNegativo($intervalo['min'] ?? null);
            $maximo = $this->numeroNoNegativo($intervalo['max'] ?? null);
            $recomendaciones = array_values(array_filter(
                $this->jsonArray($registro['recomendaciones_json'] ?? null),
                static fn (mixed $texto): bool => is_string($texto) && trim($texto) !== ''
            ));

            $muestra[] = [
                'id' => (int) ($registro['id'] ?? 0),
                'fecha' => $registro['fecha'] ?? null,
                'nombre' => (string) ($registro['nombre'] ?? 'Simulación'),
                'explicacion_modelo' => $modelo['explicacion_modelo'] ?? null,
                'entradas_modelo' => $modelo['entradas_modelo'] ?? [],
                'trazabilidad' => $modelo['trazabilidad'] ?? [],
                'parcela_ejecucion' => $modelo['parcela_ejecucion'] ?? null,
                'modelo' => $modelo['modelo'] ?? $registro['modelo_usado'] ?? null,
                'version_modelo' => $modelo['version_modelo'] ?? null,
                'rendimiento_t_ha' => round($rendimiento, 3),
                'produccion_total_t' => $produccion !== null ? round($produccion, 2) : null,
                'produccion_fuente' => $produccionGuardada !== null ? 'Resultado guardado del modelo' : 'Rendimiento estimado × área simulada',
                'area_simulada_ha' => $area,
                'categoria_cosecha' => $registro['categoria_cosecha'] ?: null,
                'probabilidad_clases_media_alta_pct' => $this->numeroEnRango($modelo['probabilidad_cosecha'] ?? null, 0, 100),
                'probabilidades_clase_pct' => is_array($modelo['probabilidades_cosecha'] ?? null) ? $modelo['probabilidades_cosecha'] : [],
                'calidad_modelo_r2_pct' => $this->numeroEnRango($registro['confianza'] ?? null, 0, 100),
                'intervalo_rendimiento' => $minimo !== null && $maximo !== null && $minimo <= $maximo
                    ? ['min' => $minimo, 'max' => $maximo, 'nivel' => $intervalo['nivel'] ?? 'aproximado']
                    : null,
                'entradas' => [
                    'temperatura_c' => $this->numeroFinito($registro['temperatura'] ?? null),
                    'humedad_pct' => $this->numeroFinito($registro['humedad'] ?? null),
                    'precipitacion_mm_año' => ($modelo['trazabilidad']['periodo_precipitacion'] ?? null) === 'mm/año'
                        ? $this->numeroFinito($registro['precipitacion'] ?? null) : null,
                    'precipitacion_mm_ciclo' => ($modelo['trazabilidad']['periodo_precipitacion'] ?? null) === 'mm/ciclo'
                        ? $this->numeroFinito($registro['precipitacion'] ?? null) : null,
                    'precipitacion_mm' => $this->numeroFinito($registro['precipitacion'] ?? null),
                    'periodo_precipitacion' => $modelo['trazabilidad']['periodo_precipitacion'] ?? 'periodo no confirmado',
                    'fertilizante_kg_ha' => $this->numeroFinito($registro['fertilizante'] ?? null),
                    'ph_suelo' => $this->numeroFinito($registro['ph_suelo'] ?? null),
                    'tipo_suelo' => $registro['tipo_suelo'] ?: null,
                ],
                'escenarios_climaticos' => $alternativas,
                'impactos_modelo_shap' => $impactos,
                'recomendaciones' => array_slice($recomendaciones, 0, 8),
            ];
        }

        if ($muestra === []) {
            return [
                ...$this->sinDatos('Esta parcela todavía no tiene una simulación de rendimiento válida.'),
                'cultivo_activo' => $cultivo,
                'mediciones_campo' => $this->mediciones?->obtener($usuarioId, $cultivoId) ?? ['datos' => [], 'indicadores' => []],
            ];
        }

        $valores = array_column($muestra, 'rendimiento_t_ha');
        $nombreVariedad = trim((string) ($cultivo['variedad_maiz'] ?? ''));
        $variedad = $this->buscarVariedad($nombreVariedad);
        $radiacion = $this->referenciaRadiacion($cultivo);
        $publicas = $this->referencias?->obtener($cultivo) ?? [];
        $mediciones = $this->mediciones?->obtener($usuarioId, $cultivoId) ?? ['datos' => [], 'indicadores' => []];

        return [
            'sin_datos' => false,
            'cultivo_activo' => $cultivo,
            'simulaciones_count' => count($muestra),
            'simulaciones_rendimiento' => $muestra,
            'kpis' => [
                'rendimiento_predicho' => $muestra[0]['rendimiento_t_ha'],
                'produccion_total_t' => $muestra[0]['produccion_total_t'],
                'area_simulada_ha' => $muestra[0]['area_simulada_ha'],
                'rendimiento_promedio_simulaciones' => round(array_sum($valores) / count($valores), 3),
                'rendimiento_minimo_simulaciones' => min($valores),
                'rendimiento_maximo_simulaciones' => max($valores),
                'rendimiento_promedio_catalogo' => $this->numeroPositivo($variedad['Rendim. Promedio (t/ha)'] ?? null),
                'rendimiento_maximo_catalogo' => $this->numeroPositivo($variedad['Rendim. Máx. (t/ha)'] ?? null),
                'radiacion_par_estimado' => $radiacion['valor'] ?? null,
            ],
            'kpi_fuentes' => [
                'rendimiento_predicho' => 'Última simulación válida de la parcela',
                'produccion_total_t' => $muestra[0]['produccion_fuente'],
                'rendimiento_promedio_catalogo' => $variedad ? 'Catálogo agronómico interno: ' . $nombreVariedad : 'Sin variedad coincidente en el catálogo',
            ],
            'nota_periodo' => 'La simulación se asocia a la parcela seleccionada, aunque su ejecución ocurra en otro año que la fecha de siembra.',
            'referencias_contexto' => ['radiacion_par' => $radiacion],
            'referencias_publicas' => $publicas,
            'mediciones_campo' => $mediciones,
        ];
    }

    private function sinDatos(string $mensaje): array
    {
        return ['sin_datos' => true, 'sin_simulaciones' => true, 'mensaje' => $mensaje];
    }

    private function buscarVariedad(string $nombre): ?array
    {
        if ($nombre === '') {
            return null;
        }
        $catalogo = $this->catalogo->cargar();
        $clave = $this->normalizarVariedad($nombre);
        $coincidencias = array_values(array_filter($catalogo['variedades_por_zona'] ?? [],
            fn (array $fila): bool => $this->normalizarVariedad((string) ($fila['Nombre / Código'] ?? '')) === $clave
        ));
        // Normalizar comillas/tildes/guiones no autoriza elegir una variedad
        // parecida ni asignar una ficha específica a "Híbrido convencional".
        return count($coincidencias) === 1 ? $coincidencias[0] : null;
    }

    private function normalizarVariedad(string $nombre): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nombre);
        return preg_replace('/[^a-z0-9]+/', '', strtolower($ascii !== false ? $ascii : $nombre)) ?? '';
    }

    private function referenciaRadiacion(array $cultivo): ?array
    {
        $latitud = $this->numeroFinito($cultivo['latitud'] ?? null);
        $longitud = $this->numeroFinito($cultivo['longitud'] ?? null);
        if ($this->terreno === null || $latitud === null || $longitud === null
            || abs($latitud) > 90 || abs($longitud) > 180) {
            return null;
        }
        try {
            $contexto = $this->terreno->obtener($latitud, $longitud, $this->numeroFinito($cultivo['altitud'] ?? null));
            $par = $this->numeroFinito($contexto['clima']['radiacion_par'] ?? null);
            if (($contexto['clima_disponible_api'] ?? false) !== true || $par === null || $par < 0) {
                return null;
            }
            return [
                'valor' => $par,
                'unidad' => 'mol/m²/día',
                'fuente' => 'Open-Meteo Archive',
                'tipo' => 'estimacion_desde_radiacion_solar',
                'periodo' => 'Ventana reciente de 30 días del proveedor; media de días disponibles',
                'metodo' => 'Radiación solar de onda corta (MJ/m²/día) × 2,06',
                'nota' => 'Contexto reciente por coordenadas, con caché de hasta 24 h. No es una medición PAR directa ni una entrada guardada de la simulación.',
            ];
        } catch (\Throwable) {
            // La ausencia del contexto meteorológico no invalida la ejecución guardada.
            return null;
        }
    }

    private function jsonArray(mixed $valor): array
    {
        $datos = json_decode((string) ($valor ?? ''), true);
        return is_array($datos) ? $datos : [];
    }

    private function numeroFinito(mixed $valor): ?float
    {
        return is_numeric($valor) && is_finite((float) $valor) ? (float) $valor : null;
    }

    private function numeroNoNegativo(mixed $valor): ?float
    {
        $numero = $this->numeroFinito($valor);
        return $numero !== null && $numero >= 0 ? $numero : null;
    }

    private function numeroPositivo(mixed $valor): ?float
    {
        $numero = $this->numeroFinito($valor);
        return $numero !== null && $numero > 0 ? $numero : null;
    }

    private function numeroEnRango(mixed $valor, float $minimo, float $maximo): ?float
    {
        $numero = $this->numeroFinito($valor);
        return $numero !== null && $numero >= $minimo && $numero <= $maximo ? $numero : null;
    }
}
