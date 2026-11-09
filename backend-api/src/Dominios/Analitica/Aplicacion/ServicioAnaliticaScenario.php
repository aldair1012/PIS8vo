<?php
// Resumen descriptivo de simulaciones guardadas; no inventa escenarios ni probabilidades futuras.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

class ServicioAnaliticaScenario
{
    public function __construct(
        private CatalogoAgronomicoInterface $catalogo,
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones
    ) {}

    public function construir(int $usuarioId, ?int $cultivoId = null, ?int $año = null): array
    {
        $cultivo = null;
        if ($cultivoId !== null) {
            $cultivo = $this->cultivos->obtenerPorId($cultivoId);
            if (!$cultivo || (int) ($cultivo['usuario_id'] ?? 0) !== $usuarioId) {
                throw new AccesoDenegadoException('Esta parcela no es válida o no está registrada a tu nombre.');
            }
        }
        // Filtrar en el repositorio antes de limitar; 50 resultados de otros
        // lotes no deben ocultar las simulaciones de la parcela solicitada.
        $registros = $cultivoId !== null
            ? $this->simulaciones->obtenerRecientesPorCultivo($usuarioId, $cultivoId, 50, $año)
            : $this->simulaciones->obtenerRecientes($usuarioId, 50, $año);
        $muestra = [];
        foreach ($registros as $fila) {
            $rendimiento = $this->numero($fila['rendimiento_estimado'] ?? null, 0);
            if ($rendimiento === null) continue;
            $escenarios = $this->jsonArray($fila['escenarios_json'] ?? null);
            $modelo = is_array($escenarios['_zeasys_modelo'] ?? null) ? $escenarios['_zeasys_modelo'] : [];
            $trazabilidad = is_array($modelo['trazabilidad'] ?? null) ? $modelo['trazabilidad'] : [];
            $snapshot = is_array($modelo['parcela_ejecucion'] ?? null) ? $modelo['parcela_ejecucion'] : [];
            $muestra[] = [
                'id' => (int) ($fila['id'] ?? 0),
                'nombre' => (string) ($fila['nombre'] ?? 'Simulación'),
                'fecha' => $fila['fecha'] ?? null,
                'rendimiento' => $rendimiento,
                'variedad' => is_string($snapshot['variedad_maiz'] ?? null) ? $snapshot['variedad_maiz'] : 'Variedad no conservada',
                'periodo_precipitacion' => $trazabilidad['periodo_precipitacion'] ?? 'legacy_no_verificado',
                'precipitacion' => $this->numero($fila['precipitacion'] ?? null, 0),
                'temperatura' => $this->numero($fila['temperatura'] ?? null),
                'humedad' => $this->numero($fila['humedad'] ?? null, 0, 100),
                'fertilizante' => $this->numero($fila['fertilizante'] ?? null, 0),
                'ph_suelo' => $this->numero($fila['ph_suelo'] ?? null, 0, 14),
            ];
        }
        if ($muestra === []) {
            return ['sin_datos' => true, 'sin_simulaciones' => true, 'cultivo_activo' => $cultivo,
                'mensaje' => 'No hay simulaciones con rendimiento válido para la parcela y el año solicitados.'];
        }

        $rendimientos = array_column($muestra, 'rendimiento');
        sort($rendimientos, SORT_NUMERIC);
        $n = count($rendimientos);
        $media = $this->media($rendimientos);
        $objetivo = 5.4; // Referencia visible y explícita; no es un umbral probabilístico calibrado.
        $fraccion = round(count(array_filter($rendimientos, static fn (float $r): bool => $r > $objetivo)) * 100 / $n, 1);
        $cv = null;
        if ($n >= 2 && $media !== null && $media > 0) {
            $varianzaRelativa = array_sum(array_map(static fn (float $r): float => ($r / $media - 1) ** 2, $rendimientos)) / $n;
            $cv = round(sqrt($varianzaRelativa) * 100, 2);
        }

        $catalogo = $this->catalogo->cargar();
        [$calendario, $mesesSiembra] = $this->calendario($catalogo, $cultivo, $año);
        $ranking = $muestra;
        usort($ranking, static fn (array $a, array $b): int => $b['rendimiento'] <=> $a['rendimiento']);
        $ranking = array_map(static fn (array $sim): array => [
            'estrategia' => $sim['nombre'],
            'combinacion' => $sim['variedad'] . ' · Simulación #' . $sim['id'],
            'valor' => round($sim['rendimiento'], 3), 'unidad' => 't/ha', 'badge' => 'Resultado guardado',
            'porque' => 'Ordenada por el rendimiento de una simulación registrada. No acredita estabilidad interanual, resiliencia, eficiencia de nitrógeno ni superioridad de una fecha de siembra.',
            'simulacion_id' => $sim['id'], 'fecha' => $sim['fecha'], 'tipo' => 'resultado_guardado',
        ], array_slice($ranking, 0, 5));
        $heatmap = array_map(static fn (array $sim): array => [
            'fecha' => 'Simulación #' . $sim['id'] . ($sim['fecha'] ? ' · ' . $sim['fecha'] : ''),
            'hibrido' => $sim['variedad'], 'valor' => round($sim['rendimiento'], 3),
            'simulacion_id' => $sim['id'], 'tipo' => 'resultado_guardado',
        ], $muestra);

        return [
            'cultivo_activo' => $cultivo,
            'kpis' => [
                'rendimiento_esperado' => round($media, 3),
                'prob_superar_objetivo' => null,
                'riesgo_agronomico' => ['nivel' => null, 'color' => 'info', 'texto' => null,
                    'motivo' => 'No hay un modelo calibrado de probabilidad o riesgo para esta muestra.'],
                'estabilidad' => null,
                'fecha_siembra_recomendada' => $mesesSiembra !== [] ? implode(', ', $mesesSiembra) : null,
            ],
            'resumen_descriptivo' => [
                'muestra' => $n, 'objetivo_referencia_t_ha' => $objetivo,
                'fraccion_supera_objetivo_pct' => $fraccion,
                'coeficiente_variacion_pct' => $cv,
                'nota' => 'Muestra de simulaciones guardadas: no es una probabilidad futura, un ensayo de variedades ni variación interanual observada.',
            ],
            'percentiles' => [
                'p10' => $this->percentil($rendimientos, 0.1), 'p50' => $this->percentil($rendimientos, 0.5), 'p90' => $this->percentil($rendimientos, 0.9),
                'tipo' => 'descriptivos_muestra_simulaciones', 'muestra' => $n,
                'metodo' => 'interpolacion_lineal_posicion_n_menos_uno',
            ],
            'heatmap' => $heatmap, 'ranking' => $ranking,
            'viabilidad_siembra' => $calendario,
            'recomendaciones' => [[
                'tipo' => 'info', 'icono' => 'CheckCircle', 'titulo' => 'Alcance del resumen',
                'texto' => 'Los rendimientos y percentiles describen las simulaciones registradas. No permiten asegurar probabilidades futuras, fechas óptimas, estabilidad entre años ni dosis agronómicas. Revisa las entradas y la trazabilidad de cada simulación.',
                'accion' => 'Revisar simulaciones',
            ]],
            'simulaciones_count' => $n,
            'simulaciones' => $muestra,
            'procedencia' => [
                'rendimiento' => ['tipo' => 'resultados_modelo_guardados', 'muestra' => $n, 'limite' => 50, 'año' => $año],
                'percentiles' => ['tipo' => 'estadistica_descriptiva', 'nota' => 'No se ajusta una distribución normal ni se extrapolan probabilidades.'],
                'probabilidad' => ['estado' => 'no_disponible', 'motivo' => 'No hay un modelo calibrado de superación del objetivo.'],
                'estabilidad' => ['estado' => 'no_disponible', 'motivo' => 'Las simulaciones seleccionadas no son cosechas observadas comparables entre años. El CV de la muestra se informa aparte.'],
                'calendario' => ['tipo' => 'referencia_catalogo_no_pronostico', 'fuente' => $calendario !== [] ? 'Catálogo agronómico local' : null],
                'precipitacion' => ['nota' => 'No se promedian ni comparan precipitaciones anuales y de ciclo. Cada simulación conserva su periodo declarado.'],
            ],
        ];
    }

    private function calendario(array $catalogo, ?array $cultivo, ?int $año): array
    {
        if ($cultivo === null) return [[], []];
        $ubicacion = $this->normalizar((string) ($cultivo['ubicacion'] ?? ''));
        $provincia = null;
        foreach (['Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'] as $nombre) {
            if (preg_match('/(?<![a-z])' . preg_quote($this->normalizar($nombre), '/') . '(?![a-z])/', $ubicacion)) {
                $provincia = $this->normalizar($nombre);
                break;
            }
        }
        if ($provincia === null) return [[], []];
        $meses = ['ENE' => 'Enero', 'FEB' => 'Febrero', 'MAR' => 'Marzo', 'ABR' => 'Abril', 'MAY' => 'Mayo', 'JUN' => 'Junio', 'JUL' => 'Julio', 'AGO' => 'Agosto', 'SEP' => 'Septiembre', 'OCT' => 'Octubre', 'NOV' => 'Noviembre', 'DIC' => 'Diciembre'];
        $ventanas = $siembra = [];
        foreach (($catalogo['calendario_siembra'] ?? []) as $fila) {
            $zona = (string) ($fila['Zona / Provincia'] ?? '');
            if (!str_contains($this->normalizar($zona), $provincia)) continue;
            foreach ($meses as $clave => $nombre) {
                $valor = trim((string) ($fila[$clave] ?? ''));
                if (!in_array($valor, ['S', 'C'], true)) continue;
                $numMes = array_search($clave, array_keys($meses), true) + 1;
                $dias = (int) (new \DateTimeImmutable(sprintf('%04d-%02d-01', $año ?? (int) date('Y'), $numMes)))->format('t');
                $ventanas[] = [
                    'rango' => "1–{$dias} {$clave}", 'estado' => ($valor === 'S' ? 'Siembra: ' : 'Cosecha: ') . $zona,
                    'evaluacion' => 'referencia_catalogo', 'color' => 'info',
                    'nota' => 'Ventana del catálogo local; no es una fecha optimizada por simulación ni garantiza rendimiento.',
                    'fuente' => 'Catálogo agronómico local', 'tipo' => 'ventana_catalogo_no_pronostico',
                ];
                if ($valor === 'S') $siembra[$nombre] = $nombre;
            }
        }
        return [$ventanas, array_values($siembra)];
    }

    private function normalizar(string $texto): string
    {
        return strtr(mb_strtolower($texto, 'UTF-8'), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n']);
    }

    private function numero(mixed $valor, ?float $minimo = null, ?float $maximo = null): ?float
    {
        if (is_bool($valor) || !is_numeric($valor)) return null;
        $n = (float) $valor;
        return is_finite($n) && ($minimo === null || $n >= $minimo) && ($maximo === null || $n <= $maximo) ? $n : null;
    }

    private function media(array $valores): ?float
    {
        return $valores === [] ? null : array_sum(array_map(static fn (float $v): float => $v / count($valores), $valores));
    }

    private function percentil(array $ordenados, float $p): float
    {
        $posicion = (count($ordenados) - 1) * $p;
        $inferior = (int) floor($posicion);
        $superior = (int) ceil($posicion);
        return round($ordenados[$inferior] + ($ordenados[$superior] - $ordenados[$inferior]) * ($posicion - $inferior), 3);
    }

    private function jsonArray(mixed $valor): array
    {
        if (is_array($valor)) return $valor;
        if (!is_string($valor)) return [];
        $datos = json_decode($valor, true);
        return is_array($datos) ? $datos : [];
    }
}
