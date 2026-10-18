<?php
// ChatService.php — prepara el contexto autorizado y entrega la pregunta al flujo Gemini.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Aplicacion;

use ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface;
use ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;

/**
 * El backend no redacta ni resuelve preguntas. Sólo valida la parcela,
 * reúne los datos visibles/autorizados y los envía al chatflow de Gemini.
 */
final class ChatService
{
    public function __construct(
        private MemoriaSesionInterface $memoria,
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones,
        private GeminiFlowise $gemini,
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
    ): array {
        $pregunta = trim($pregunta);
        if ($pregunta === '') {
            throw new \InvalidArgumentException('La pregunta no puede estar vacía.');
        }

        $contextoPrevio = $this->memoria->contexto();
        if (array_key_exists('cultivo_id', $contextoPrevio)
            && ((int) ($contextoPrevio['cultivo_id'] ?? 0) !== (int) ($cultivoId ?? 0)
                || ($contextoPrevio['anio'] ?? null) !== $anio)) {
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
                } elseif ($cultivosUsuario !== []) {
                    $cultivoSeleccionado = $cultivosUsuario[0];
                }

                $simulacionesRecientes = $this->simulaciones->obtenerRecientes($usuarioId, 12, $anio);
                if ($cultivoId !== null) {
                    $simulacionesRecientes = array_values(array_filter(
                        $simulacionesRecientes,
                        static fn (array $simulacion): bool => (int) ($simulacion['cultivo_id'] ?? 0) === $cultivoId,
                    ));
                }
            } catch (\Throwable $e) {
                if ($e instanceof AccesoDenegadoException) {
                    throw $e;
                }
                // Gemini puede responder con el dashboard aunque una consulta
                // secundaria de historial esté temporalmente indisponible.
            }
        }

        $dashboardContexto = $this->normalizar($dashboard);
        $historial = array_slice($this->memoria->historial(), -8);
        $contexto = [
            'fecha_local' => date('Y-m-d'),
            'panel_actual' => $vista,
            'anio_seleccionado' => $anio,
            'cultivo_id_seleccionado' => $cultivoId,
            'cultivo_activo' => $this->normalizar($cultivoSeleccionado),
            'cultivos_autorizados' => $this->normalizar($cultivosUsuario),
            'simulaciones_recientes' => $this->normalizar(array_slice($simulacionesRecientes, 0, 8)),
            'dashboard_visible' => $dashboardContexto,
            'historial_conversacion' => $this->normalizar($historial),
        ];

        $texto = $this->gemini->responder(
            $pregunta,
            $contexto,
            $usuarioId,
            $cultivoId,
            $anio,
            $this->memoria->identificadorConversacion(),
        );

        $this->memoria->registrar('usuario', $pregunta);
        $this->memoria->registrar('asistente', $texto);
        $this->memoria->registrarTema('gemini');
        $this->memoria->registrarContexto([
            'cultivo_id' => $cultivoId,
            'anio' => $anio,
            'panel_actual' => $vista,
        ]);

        return [
            'texto' => $texto,
            'secciones' => [],
            'accion' => null,
            'confianza' => 1.0,
            'intencion' => 'gemini',
            'fuente_datos' => [
                'proveedor' => 'Google Gemini mediante Flowise',
                'respuesta_directa_del_flujo' => true,
                'parcela_id' => $cultivoId,
                'anio' => $anio,
                'vista' => $vista,
                'dashboard_sincronizado' => $dashboardContexto !== null,
            ],
        ];
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
