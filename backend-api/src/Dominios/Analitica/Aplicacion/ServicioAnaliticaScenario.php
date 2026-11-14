<?php
// Resumen descriptivo de simulaciones guardadas; no inventa escenarios ni probabilidades futuras.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Terreno\Aplicacion\ProvinciaParcela;
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
        if ($cultivoId === null) return ['sin_datos'=>true,'cultivo_activo'=>null,'mensaje'=>'Selecciona una parcela para consultar Siembra.'];
        if ($cultivoId !== null) {
            $cultivo = $this->cultivos->obtenerPorId($cultivoId);
            if (!$cultivo || (int) ($cultivo['usuario_id'] ?? 0) !== $usuarioId || (isset($cultivo['activo']) && !(bool) $cultivo['activo'])) {
                throw new AccesoDenegadoException('Esta parcela no es válida o no está registrada a tu nombre.');
            }
        }
        $provincia = ProvinciaParcela::resolver($cultivo);
        $cultivo['provincia'] = $provincia['provincia'];
        $cultivo['fuente_provincia'] = $provincia['fuente'];
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
        $rendimientos = array_column($muestra, 'rendimiento');
        sort($rendimientos, SORT_NUMERIC);
        $n = count($rendimientos);
        $media = $this->media($rendimientos);
        // Sin objetivo declarado por el productor, no se inventa un umbral agrícola.
        $objetivo = null;
        $fraccion = null;
        $cv = null;
        if ($n >= 2 && $media !== null && $media > 0) {
            $varianzaRelativa = array_sum(array_map(static fn (float $r): float => ($r / $media - 1) ** 2, $rendimientos)) / $n;
            $cv = round(sqrt($varianzaRelativa) * 100, 2);
        }

        $catalogo = $this->catalogo->cargar();
        [$calendario, $mesesSiembra] = $this->calendario($catalogo, $cultivo, $año);
        $ultima = $this->simulaciones->obtenerUltimaPorCultivo($cultivoId) ?? ($registros[0] ?? null);
        $fechaUltima = $this->fecha($ultima['fecha'] ?? null);
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
            'sin_datos' => $n === 0, 'sin_simulaciones' => $n === 0,
            'cultivo_activo' => $cultivo,
            'años_disponibles' => $this->simulaciones->obtenerAniosPorUsuario($usuarioId),
            'año_ultima_simulacion' => $fechaUltima !== null ? (int) substr($fechaUltima, 0, 4) : null,
            'calendario_parcela' => $this->calendarioParcela($cultivo, $ultima),
            'kpis' => [
                'rendimiento_esperado' => $media === null ? null : round($media, 3),
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
                'p10' => $n ? $this->percentil($rendimientos, 0.1) : null, 'p50' => $n ? $this->percentil($rendimientos, 0.5) : null, 'p90' => $n ? $this->percentil($rendimientos, 0.9) : null,
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
        if (!is_string($cultivo['provincia'] ?? null)) return [[], []];
        $provincia = $this->normalizar($cultivo['provincia']);
        $tipo = $this->normalizar((string) ($cultivo['tipo_maiz'] ?? ''));
        $meses = ['ENE' => 'Enero', 'FEB' => 'Febrero', 'MAR' => 'Marzo', 'ABR' => 'Abril', 'MAY' => 'Mayo', 'JUN' => 'Junio', 'JUL' => 'Julio', 'AGO' => 'Agosto', 'SEP' => 'Septiembre', 'OCT' => 'Octubre', 'NOV' => 'Noviembre', 'DIC' => 'Diciembre'];
        $ventanas = $siembra = [];
        foreach (($catalogo['calendario_siembra'] ?? []) as $fila) {
            $zona = (string) ($fila['Zona / Provincia'] ?? '');
            if (!str_contains($this->normalizar($zona), $provincia)) continue;
            $tipoReferencia = (string) ($fila['Tipo Maíz'] ?? '');
            $familiaReferencia = $this->normalizar($tipoReferencia);
            if ((str_contains($tipo, 'suave') && str_contains($familiaReferencia, 'duro')) || (str_contains($tipo, 'duro') && str_contains($familiaReferencia, 'suave'))) continue;
            foreach ($meses as $clave => $nombre) {
                $valor = trim((string) ($fila[$clave] ?? ''));
                if (!in_array($valor, ['S', 'C'], true)) continue;
                $numMes = array_search($clave, array_keys($meses), true) + 1;
                $dias = (int) (new \DateTimeImmutable(sprintf('%04d-%02d-01', $año ?? (int) date('Y'), $numMes)))->format('t');
                $ventanas[] = [
                    'rango' => "1–{$dias} {$clave}", 'estado' => ($valor === 'S' ? 'Siembra: ' : 'Cosecha: ') . $zona,
                    'evaluacion' => 'referencia_catalogo', 'color' => 'info',
                    'nota' => 'Ventana del catálogo local' . ($tipoReferencia !== '' ? ' para ' . $tipoReferencia : '') . '; no es una fecha optimizada por simulación ni garantiza rendimiento.',
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

    private function fecha(mixed $valor): ?string
    {
        if (!is_string($valor) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/', $valor, $m)) return null;
        $year=(int)$m[1];
        return $year>=2000 && $year<=2100 && checkdate((int)$m[2],(int)$m[3],$year) ? substr($valor,0,10) : null;
    }

    /** Fechas existentes del lote y de una ejecución compatible; nunca deduce una cosecha real. */
    private function calendarioParcela(array $cultivo, ?array $ultima): array
    {
        $json=$this->jsonArray($ultima['escenarios_json']??null);
        $guardado=$json['_zeasys_modelo']['trazabilidad']['calendario']??[];
        if (!is_array($guardado)) $guardado=[];
        $fechaGuardada=$this->fecha($guardado['fecha_siembra']??null);
        $fechaActual=$this->fecha($cultivo['fecha_siembra']??null);
        $inicio=$fechaActual??$fechaGuardada;
        $tipo=$fechaActual!==null?($cultivo['tipo_fecha_siembra']??null):'prevista';
        $ciclo=$this->numero($cultivo['ciclo_dias']??null,1,730);
        $origenCiclo=$ciclo!==null?'Duración declarada por el productor':null;
        $fin=null;$eventos=[];
        if ($inicio!==null) {
            $titulo=$fechaActual===null?'Siembra planificada en simulación #'.($ultima['id']??'')
                :($tipo==='real_declarada'?'Siembra real declarada por el productor':($tipo==='prevista'?'Siembra prevista por el productor':'Siembra registrada · tipo por confirmar'));
            $fuente=$fechaActual!==null?'Fecha guardada por el productor':'Fecha conservada en simulación #'.($ultima['id']??'');
            $eventos[]=['fecha'=>$inicio,'tipo'=>$fechaActual!==null?'siembra_registrada':'siembra_simulada','titulo'=>$titulo,'fuente'=>$fuente,
                'nota'=>$tipo==='real_declarada'?'Actividad declarada por el productor; no verificada independientemente.':'Planificación o fecha sin clasificar; no confirma una siembra realizada.'];
        }
        if ($inicio!==null && $ciclo!==null) {
            $fin=\ZeaSys\Dominios\Lotes\Dominio\PlanificacionParcela::fin($inicio,(int)$ciclo);
        } elseif ($inicio!==null && $fechaGuardada===$inicio) {
            $finGuardado=$this->fecha($guardado['fecha_fin_estimada']??null);
            if ($finGuardado!==null && $finGuardado>=$inicio) {
                $fin=$finGuardado;
                $ciclo=$this->numero($guardado['ciclo_dias']??null,1,730);
                $origenCiclo=is_string($guardado['origen_duracion']??null)?$guardado['origen_duracion']:'Duración conservada en la simulación';
            }
        }
        if ($fin!==null) $eventos[]=['fecha'=>$fin,'tipo'=>'fin_ciclo_estimado','titulo'=>'Fin estimado del ciclo','fuente'=>$origenCiclo??'Simulación #'.($ultima['id']??''),
            'nota'=>'Fecha orientativa; no es una cosecha observada ni garantiza madurez o clima futuro.'];
        return ['eventos'=>$eventos,'simulacion_id'=>$ultima['id']??null,'fecha_siembra'=>$inicio,'tipo_fecha_siembra'=>$tipo,
            'fuente_fecha'=>$fuente??null,'fecha_fin_estimada'=>$fin,'ciclo_dias'=>$ciclo,'origen_duracion'=>$origenCiclo,'riego_tipo'=>$cultivo['riego_tipo']??null,
            'nota'=>count($eventos)>1?'Fechas de tu planificación. El fin del ciclo es una referencia estimada.'
                :($eventos!==[]?'Completa la duración prevista para obtener una fecha orientativa de fin de ciclo.':'Completa la planificación para activar el calendario de tu cultivo.')];
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
