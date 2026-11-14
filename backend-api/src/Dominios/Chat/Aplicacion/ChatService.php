<?php
// ChatService.php — prepara el contexto autorizado y entrega la pregunta al flujo de IA.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Aplicacion;

use ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface;
use ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Aplicacion\CatalogoMaiz;
use ZeaSys\Dominios\Terreno\Aplicacion\ProvinciaParcela;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

/**
 * El backend no redacta ni resuelve preguntas. Sólo valida la parcela,
 * reúne los datos visibles/autorizados y los envía al chatflow de Flowise.
 */
final class ChatService
{
    public function __construct(
        private MemoriaSesionInterface $memoria,
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones,
        private GeminiFlowise $flujoIa,
        private ContextoAgricolaService $contextoAgricola,
        private FavoritoService $favoritos,
    ) {
    }

    public function limpiarMemoria(): void
    {
        $this->memoria->limpiar();
    }

    /**
     * @return array{texto:string,secciones:array,accion:?string,confianza:?float,intencion:string,fuente_datos:array}
     */
    public function preguntar(
        string $pregunta,
        ?string $vista = null,
        int $usuarioId = 0,
        ?int $cultivoId = null,
        ?int $año = null,
        ?array $dashboard = null,
        ?array $simulacion = null,
    ): array {
        $pregunta = trim($pregunta);
        if ($pregunta === '') {
            throw new \InvalidArgumentException('La pregunta no puede estar vacía.');
        }

        // El borrador sólo tiene sentido en Nueva Simulación. Si otra vista
        // reutiliza la llamada, se ignora para no mezclar datos de formulario
        // con un dashboard ya guardado.
        if ($vista !== 'simular') {
            $simulacion = null;
        }

        // Los paneles del dashboard (Rendimiento, Siembra, Clima, Finanzas,
        // Mapa, Historial) comparten una sola conversación por parcela y año.
        // Nueva Simulación conserva una memoria aparte porque trabaja con el
        // borrador del formulario. La memoria no se reinicia al cambiar de
        // panel: sólo cuando cambia la parcela, el año o el ámbito.
        $ambito = $vista === 'simular' ? 'simulacion' : 'dashboard';

        $contextoPrevio = $this->memoria->contexto();
        if (array_key_exists('cultivo_id', $contextoPrevio)
            && ((int) ($contextoPrevio['cultivo_id'] ?? 0) !== (int) ($cultivoId ?? 0)
                || ($contextoPrevio['año'] ?? null) !== $año
                || ($contextoPrevio['ambito'] ?? 'dashboard') !== $ambito)) {
            $this->memoria->limpiar();
        }

        $cultivosUsuario = [];
        $simulacionesRecientes = [];
        $cultivoSeleccionado = null;

        if ($usuarioId > 0) {
            try {
                $cultivosUsuario = $this->cultivos->obtenerPorUsuario($usuarioId);
                if ($cultivoId !== null) {
                    foreach ($cultivosUsuario as $cultivo) {
                        if ((int) ($cultivo['id'] ?? 0) === $cultivoId) {
                            $cultivoSeleccionado = $cultivo;
                            break;
                        }
                    }
                    if ($cultivoSeleccionado === null) {
                        throw new AccesoDenegadoException('La parcela seleccionada no pertenece a tu cuenta.');
                    }
                    $cultivosUsuario = [$cultivoSeleccionado];
                } elseif ($cultivosUsuario !== [] && $vista !== 'simular') {
                    // En el resto de paneles se conserva el comportamiento
                    // histórico. En Nueva Simulación no se debe asumir la
                    // primera parcela: el formulario puede estar vacío o
                    // apuntar a otra parcela distinta de la del navbar.
                    $cultivoSeleccionado = $cultivosUsuario[0];
                } else {
                    $cultivosUsuario = [];
                }

                $simulacionesRecientes = $this->simulaciones->obtenerRecientes($usuarioId, 12, $año);
                if ($cultivoId !== null) {
                    $simulacionesRecientes = array_values(array_filter(
                        $simulacionesRecientes,
                        static fn (array $simulacion): bool => (int) ($simulacion['parcela_id'] ?? 0) === $cultivoId,
                    ));
                } elseif ($vista === 'simular') {
                    $simulacionesRecientes = [];
                }
            } catch (\Throwable $e) {
                if ($e instanceof AccesoDenegadoException) {
                    throw $e;
                }
                // El modelo puede responder con el dashboard aunque una consulta
                // secundaria de historial esté temporalmente indisponible.
            }
        }

        $simulacionSeleccionada = $this->resolverSimulacionSeleccionada($vista, $dashboard, $usuarioId, $cultivoId);
        $contextoAgricola = [];
        if ($usuarioId > 0 && is_array($cultivoSeleccionado)) {
            try {
                $contextoAgricola = $this->contextoAgricola->construir(
                    $usuarioId,
                    (int) ($cultivoSeleccionado['id'] ?? 0),
                    $año,
                    $simulacionesRecientes,
                    $vista === 'scenarios',
                );
            } catch (\Throwable) {
                // El dashboard visible y las simulaciones siguen disponibles
                // aunque una fuente auxiliar (clima, precio o analítica) falle.
            }
        }

        $simulacionBorrador = $this->normalizarSimulacion($simulacion, $cultivoSeleccionado);
        if ($simulacionBorrador !== null) {
            $contextoAgricola = $this->aplicarBorradorAlContexto($contextoAgricola, $simulacionBorrador);
        }

        $dashboardContexto = $this->normalizar($dashboard);
        $historial = array_slice($this->memoria->historial(), -8);
        $contexto = [
            'fecha_local' => date('Y-m-d'),
            'panel_actual' => $vista,
            'ambito' => $ambito,
            'año_seleccionado' => $año,
            'cultivo_id_seleccionado' => $cultivoId,
            'cultivo_activo' => $this->normalizar($cultivoSeleccionado),
            'cultivos_autorizados' => $this->normalizar($cultivosUsuario),
            'simulacion_borrador' => $this->normalizar($simulacionBorrador),
            'simulaciones_recientes' => $this->normalizar(array_slice($simulacionesRecientes, 0, 8)),
            'contexto_agricola' => $this->normalizar($contextoAgricola),
            'dashboard_visible' => $dashboardContexto,
            'simulacion_seleccionada' => $simulacionSeleccionada,
            'historial_conversacion' => $this->normalizar($historial),
        ];

        // Las conversaciones guardadas actúan como memoria de largo plazo.
        // Sólo se incorporan al contexto si existen; el cliente del flujo las
        // envía al modelo únicamente cuando la pregunta las menciona.
        if ($usuarioId > 0) {
            try {
                $favoritosContexto = $this->favoritos->recientesParaContexto($usuarioId, $cultivoId, $año, 4);
                if ($favoritosContexto !== []) {
                    $contexto['conversaciones_favoritas'] = $favoritosContexto;
                }
            } catch (\Throwable) {
                // El asistente puede responder sin la memoria guardada.
            }
        }

        $identificadorConversacion = $this->memoria->identificadorConversacion();
        $texto = $this->flujoIa->responder(
            $pregunta,
            $contexto,
            $usuarioId,
            $cultivoId,
            $año,
            $identificadorConversacion,
            $ambito,
        );

        $this->memoria->registrar('usuario', $pregunta);
        $this->memoria->registrar('asistente', $texto);
        $this->memoria->registrarTema('asistente');
        $this->memoria->registrarContexto([
            'cultivo_id' => $cultivoId,
            'año' => $año,
            'ambito' => $ambito,
            'panel_actual' => $vista,
        ]);

        return [
            'texto' => $texto,
            'secciones' => [],
            'accion' => null,
            // No existe una probabilidad calibrada para cada respuesta generada.
            'confianza' => null,
            'intencion' => 'asistente',
            'fuente_datos' => [
                'proveedor' => 'Flowise (proveedor configurado en el chatflow)',
                'respuesta_directa_del_flujo' => true,
                'referencias_consultadas' => array_map(static fn (array $ref): array => array_intersect_key($ref, array_flip(['archivo','pagina_pdf','año_fuente','extracto_cotejado_visualmente'])), $this->flujoIa->referenciasConsultadas()),
                'parcela_id' => $cultivoId,
                'año' => $año,
                'vista' => $vista,
                'ambito' => $ambito,
                'conversacion_id' => $identificadorConversacion,
                'dashboard_sincronizado' => $dashboardContexto !== null,
                'simulacion_borrador' => $simulacionBorrador !== null,
                'contexto_combinado' => $contextoAgricola !== [] || $simulacionBorrador !== null,
                'clima_actual_disponible' => is_array($contextoAgricola['clima']['actual'] ?? null),
                'clima_pronostico_dias' => is_array($contextoAgricola['clima']['pronostico_7d'] ?? null)
                    ? count($contextoAgricola['clima']['pronostico_7d'])
                    : 0,
                'precio_referencia_disponible' => (bool) ($contextoAgricola['precio_maiz']['disponible'] ?? false),
            ],
        ];
    }

    /**
     * Persiste la conversación actual como favorita del usuario. Los mensajes
     * y la parcela se validan en FavoritoService.
     *
     * @param array<string, mixed> $datos
     * @return array<string, mixed>
     */
    public function guardarFavorito(int $usuarioId, array $datos): array
    {
        return ['ok' => true] + $this->favoritos->guardar($usuarioId, $datos);
    }

    public function eliminarFavorito(int $usuarioId, string $conversacionId): void
    {
        $this->favoritos->eliminar($usuarioId, $conversacionId);
    }

    /** Recupera la ejecución visible desde la cuenta y parcela autorizadas. */
    private function resolverSimulacionSeleccionada(?string $vista, ?array $dashboard, int $usuarioId, ?int $cultivoId): ?array
    {
        if ($vista !== 'yield' || !isset($dashboard['simulacion_seleccionada'])) return null;
        $selected = $dashboard['simulacion_seleccionada'];
        $id = is_array($selected) ? filter_var($selected['id'] ?? null, FILTER_VALIDATE_INT) : false;
        if ($id === false || $id < 1) throw new ValidacionException('La simulación seleccionada no es válida.');
        $row = $this->simulaciones->obtenerPorId($id);
        if ($usuarioId < 1 || $cultivoId === null || !$row || (int) ($row['usuario_id'] ?? 0) !== $usuarioId || (int) ($row['parcela_id'] ?? 0) !== $cultivoId) {
            throw new AccesoDenegadoException('La simulación seleccionada no pertenece a esta parcela de tu cuenta.');
        }
        return $row;
    }

    /**
     * Convierte el formulario de Nueva Simulación en un bloque seguro y acotado.
     * La parcela y su área proceden de la base de datos autorizada; el resto son
     * valores visibles del formulario, no una ejecución. Descarta campos fuera de rango.
     * @param array<string, mixed>|null $simulacion
     * @param array<string, mixed>|null $cultivo
     * @return array<string, mixed>|null
     */
    private function normalizarSimulacion(?array $simulacion, ?array $cultivo): ?array
    {
        if ($simulacion === null || !is_array($cultivo)) {
            return null;
        }

        $texturas = [
            'franco' => 'Franco Limoso',
            'franco limoso' => 'Franco Limoso',
            'arcilloso' => 'Franco Arcilloso',
            'franco arcilloso' => 'Franco Arcilloso',
            'arenoso' => 'Franco Arenoso',
            'franco arenoso' => 'Franco Arenoso',
        ];
        $texturaCodigo = is_string($simulacion['tipo_suelo'] ?? null)
            ? mb_strtolower(trim($simulacion['tipo_suelo']), 'UTF-8')
            : '';
        $tipos = json_decode((string)file_get_contents(__DIR__.'/../../../../data/referencias/tipos-suelo.json'),true,512,JSON_THROW_ON_ERROR);
        foreach ($tipos as $code=>$rule) $texturas[$code] ??= $rule['label'];
        $textura = $texturas[$texturaCodigo] ?? null;

        $areaParcela = $this->numeroRango($cultivo['area'] ?? null, 0.0001, 1000000);
        $areaSimulada = $this->numeroRango($simulacion['area_simulada'] ?? null, 0.0001, 1000000);
        $phEntrada = $this->numeroRango($simulacion['ph_suelo'] ?? null, 0, 14);
        $lluviaCicloExplicita = array_key_exists('precipitacion_ciclo_mm', $simulacion);
        $campos = [];
        $schema = json_decode((string) file_get_contents(__DIR__.'/../../../../data/referencias/entradas-campo.json'), true, 512, JSON_THROW_ON_ERROR);
        $rawCampos = is_array($simulacion['parametros_campo'] ?? null) ? $simulacion['parametros_campo'] : [];
        foreach ($schema['campos'] as $key => $rule) {
            $raw = $rawCampos[$key] ?? null;
            if ($raw === null || is_bool($raw) || !is_scalar($raw) || $raw === '') continue;
            if (isset($rule['opciones'])) {
                if (array_key_exists((string) $raw, $rule['opciones'])) $campos[$key] = !empty($rule['entero']) ? (int) $raw : (string) $raw;
                continue;
            }
            $value = $this->numeroRango($raw, $rule['min'], $rule['max']);
            if ($value !== null && (empty($rule['entero']) || floor($value) === $value)) $campos[$key] = $value;
        }
        $fecha = $simulacion['fecha_siembra'] ?? null;
        $date = is_string($fecha) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $fecha) === 1 ? \DateTimeImmutable::createFromFormat('!Y-m-d', $fecha) : false;
        $fecha = $date && $date->format('Y-m-d') === $fecha && $date->format('Y') >= '1950' && $date->format('Y') <= '2100' ? $fecha : null;
        $catalogo = new CatalogoMaiz();
        $ficha = $catalogo->buscar((string) ($cultivo['variedad_maiz'] ?? ''));

        $salida = [
            'estado' => 'borrador_no_ejecutado',
            'origen' => 'Formulario Nueva Simulación',
            'parcela_id' => (int) ($cultivo['id'] ?? 0),
            'nombre_parcela' => (string) ($cultivo['nombre_parcela'] ?? ''),
            'provincia_identificada' => ProvinciaParcela::resolver($cultivo),
            'area_parcela_ha' => $areaParcela,
            'area_simulada_ha' => $areaSimulada,
            'temperatura_entrada_c' => $this->numeroRango($simulacion['temperatura'] ?? null, -10, 60),
            'humedad_entrada_pct' => $this->numeroRango($simulacion['humedad'] ?? null, 0, 100),
            'precipitacion_anual_entrada_mm' => $lluviaCicloExplicita ? null : $this->numeroRango($simulacion['precipitacion'] ?? null, 0, 20000),
            'precipitacion_ciclo_entrada_mm' => $lluviaCicloExplicita ? $this->numeroRango($simulacion['precipitacion_ciclo_mm'], 0, 4000) : null,
            'periodo_precipitacion' => $lluviaCicloExplicita ? 'mm/ciclo' : 'mm/año (contrato anterior)',
            'parametros_campo' => $campos,
            'fecha_siembra' => $fecha,
            'variedad_documentada' => $ficha === null ? null : [
                'nombre'=>$ficha['nombre'], 'usos_documentados'=>$ficha['usos_documentados'],
                'dias_orientativos_por_uso'=>$ficha['cosecha_orientativa_dias'],
                'simulacion_grano_habilitada'=>$ficha['simulacion_grano_habilitada'],
                'fuentes'=>array_slice($catalogo->evaluar($cultivo)['actual']['fuentes'],0,3),
                'nota'=>'Ficha documental. La simulación actual estima grano seco; otros destinos requieren su modelo propio. No acredita precisión de cosecha.',
            ],
            'fertilizante_n_entrada_kg_ha' => $this->numeroRango($simulacion['fertilizante'] ?? null, 0, 2000),
            'ph_suelo_entrada' => $phEntrada,
            'textura_suelo_entrada' => $textura,
            'nota' => 'Valores visibles del formulario; algunos se autocompletan desde Open-Meteo/SoilGrids y pueden haber sido editados. No es una simulación guardada ni un resultado calculado.',
        ];

        $faltantes = [];
        foreach ([
            'area_simulada_ha' => 'área a simular',
            'temperatura_entrada_c' => 'temperatura media',
            'humedad_entrada_pct' => 'humedad relativa',
            ($lluviaCicloExplicita ? 'precipitacion_ciclo_entrada_mm' : 'precipitacion_anual_entrada_mm') => $lluviaCicloExplicita ? 'lluvia acumulada del ciclo' : 'precipitación anual',
            'fertilizante_n_entrada_kg_ha' => 'fertilizante/nitrógeno',
            'ph_suelo_entrada' => 'pH del suelo',
            'textura_suelo_entrada' => 'textura del suelo',
        ] as $clave => $etiqueta) {
            if ($salida[$clave] === null) {
                $faltantes[] = $etiqueta;
            }
        }
        if ($faltantes !== []) {
            $salida['campos_faltantes'] = $faltantes;
        }
        if ($areaParcela !== null && $areaSimulada !== null && $areaSimulada > $areaParcela) {
            $salida['area_excede_parcela'] = true;
        }
        if (($simulacion['cargando_ubicacion'] ?? false) === true) {
            $salida['cargando_ubicacion'] = true;
        }

        return $salida;
    }

    /**
     * El formulario es la fuente principal para pH y textura de la simulación
     * en edición. Se reemplaza el valor de SoilGrids para que el modelo no
     * mezcle ambos suelos en la misma recomendación.
     *
     * @param array<string, mixed> $contexto
     * @param array<string, mixed> $borrador
     * @return array<string, mixed>
     */
    private function aplicarBorradorAlContexto(array $contexto, array $borrador): array
    {
        if (!is_array($contexto['nutricion'] ?? null)) {
            return $contexto;
        }

        $ph = $borrador['ph_suelo_entrada'] ?? null;
        if (is_numeric($ph)) {
            $contexto['nutricion']['ph_suelo'] = (float) $ph;
            $contexto['nutricion']['ph_suelo_fuente'] = 'Formulario de Nueva Simulación';
        }

        $textura = $borrador['textura_suelo_entrada'] ?? null;
        if (is_string($textura) && $textura !== '') {
            $contexto['nutricion']['textura_suelo'] = $textura;
            $contexto['nutricion']['textura_suelo_fuente'] = 'Formulario de Nueva Simulación';
        }

        return $contexto;
    }

    private function numeroRango(mixed $valor, float $minimo, float $maximo): ?float
    {
        if ($valor === null || $valor === '' || is_bool($valor)) {
            return null;
        }
        if (is_string($valor)) {
            $valor = str_replace(',', '.', trim($valor));
        }
        if (!is_numeric($valor)) {
            return null;
        }
        $numero = (float) $valor;
        if (!is_finite($numero) || $numero < $minimo || $numero > $maximo) {
            return null;
        }
        return round($numero, 2);
    }

    /**
     * Evita enviar objetos inesperados o snapshots gigantes al proveedor.
     * Conserva números, booleanos y texto del dashboard sin reinterpretarlos.
     */
    private function normalizar(mixed $valor, int $nivel = 0): mixed
    {
        if ($valor === null || is_bool($valor) || is_int($valor) || is_float($valor)) {
            return $valor;
        }
        if ($nivel > 5) {
            return null;
        }
        if (is_string($valor)) {
            return mb_substr($valor, 0, 500, 'UTF-8');
        }
        if (!is_array($valor)) {
            return null;
        }

        $salida = [];
        foreach (array_slice($valor, 0, 60, true) as $clave => $item) {
            $salida[(string) $clave] = $this->normalizar($item, $nivel + 1);
        }
        return $salida;
    }
}
