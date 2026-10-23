<?php
// ChatService.php — prepara el contexto autorizado y entrega la pregunta al flujo de IA.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Aplicacion;

use ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface;
use ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

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
     * @return array{texto:string,secciones:array,accion:?string,confianza:float,intencion:string,fuente_datos:array}
     */
    public function preguntar(
        string $pregunta,
        ?string $vista = null,
        int $usuarioId = 0,
        ?int $cultivoId = null,
        ?int $anio = null,
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
                || ($contextoPrevio['anio'] ?? null) !== $anio
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

                $simulacionesRecientes = $this->simulaciones->obtenerRecientes($usuarioId, 12, $anio);
                if ($cultivoId !== null) {
                    $simulacionesRecientes = array_values(array_filter(
                        $simulacionesRecientes,
                        static fn (array $simulacion): bool => (int) ($simulacion['cultivo_id'] ?? 0) === $cultivoId,
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

        $contextoAgricola = [];
        if ($usuarioId > 0 && is_array($cultivoSeleccionado)) {
            try {
                $contextoAgricola = $this->contextoAgricola->construir(
                    $usuarioId,
                    (int) ($cultivoSeleccionado['id'] ?? 0),
                    $anio,
                    $simulacionesRecientes,
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
            'anio_seleccionado' => $anio,
            'cultivo_id_seleccionado' => $cultivoId,
            'cultivo_activo' => $this->normalizar($cultivoSeleccionado),
            'cultivos_autorizados' => $this->normalizar($cultivosUsuario),
            'simulacion_borrador' => $this->normalizar($simulacionBorrador),
            'simulaciones_recientes' => $this->normalizar(array_slice($simulacionesRecientes, 0, 8)),
            'contexto_agricola' => $this->normalizar($contextoAgricola),
            'dashboard_visible' => $dashboardContexto,
            'historial_conversacion' => $this->normalizar($historial),
        ];

        // Las conversaciones guardadas actúan como memoria de largo plazo.
        // Sólo se incorporan al contexto si existen; el cliente del flujo las
        // envía al modelo únicamente cuando la pregunta las menciona.
        if ($usuarioId > 0) {
            try {
                $favoritosContexto = $this->favoritos->recientesParaContexto($usuarioId, $cultivoId, $anio, 4);
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
            $anio,
            $identificadorConversacion,
            $ambito,
        );

        $this->memoria->registrar('usuario', $pregunta);
        $this->memoria->registrar('asistente', $texto);
        $this->memoria->registrarTema('asistente');
        $this->memoria->registrarContexto([
            'cultivo_id' => $cultivoId,
            'anio' => $anio,
            'ambito' => $ambito,
            'panel_actual' => $vista,
        ]);

        return [
            'texto' => $texto,
            'secciones' => [],
            'accion' => null,
            'confianza' => 1.0,
            'intencion' => 'asistente',
            'fuente_datos' => [
                'proveedor' => 'Flowise (proveedor configurado en el chatflow)',
                'respuesta_directa_del_flujo' => true,
                'parcela_id' => $cultivoId,
                'anio' => $anio,
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

    /**
     * Convierte el formulario de Nueva Simulación en un bloque seguro y
     * acotado. La parcela y su área proceden de la base de datos autorizada;
     * el resto son valores visibles del formulario, no una simulación
     * ejecutada. Se descartan campos desconocidos o fuera de rango.
     *
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
        $textura = $texturas[$texturaCodigo] ?? null;

        $areaParcela = $this->numeroRango($cultivo['area'] ?? null, 0.0001, 1000000);
        $areaSimulada = $this->numeroRango($simulacion['area_simulada'] ?? null, 0.0001, 1000000);
        $phEntrada = $this->numeroRango($simulacion['ph_suelo'] ?? null, 0, 14);

        $salida = [
            'estado' => 'borrador_no_ejecutado',
            'origen' => 'Formulario Nueva Simulación',
            'parcela_id' => (int) ($cultivo['id'] ?? 0),
            'nombre_parcela' => (string) ($cultivo['nombre_parcela'] ?? ''),
            'area_parcela_ha' => $areaParcela,
            'area_simulada_ha' => $areaSimulada,
            'temperatura_entrada_c' => $this->numeroRango($simulacion['temperatura'] ?? null, -10, 60),
            'humedad_entrada_pct' => $this->numeroRango($simulacion['humedad'] ?? null, 0, 100),
            'precipitacion_anual_entrada_mm' => $this->numeroRango($simulacion['precipitacion'] ?? null, 0, 20000),
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
            'precipitacion_anual_entrada_mm' => 'precipitación anual',
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
