<?php
// src/Dominios/Chat/Http/ChatController.php — Controlador delgado del chatbot.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Http;

use ZeaSys\Dominios\Chat\Aplicacion\ChatService;
use ZeaSys\Dominios\Chat\Infraestructura\ConsentimientoAsistente;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Errores\ZeaSysException;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;
use ZeaSys\Kernel\SesionSinBloqueo;

final class ChatController
{
    private const VISTAS_VALIDAS = ['yield', 'scenarios', 'climate', 'finance', 'map', 'simular', 'history', 'asistente'];

    public function __construct(private ChatService $servicio, private ConsentimientoAsistente $consentimiento) {}

    public function consentimiento(Peticion $peticion): void
    {
        $usuario = $this->usuarioId();
        if ($peticion->metodo() === 'GET') {
            RespuestaJson::enviar($this->consentimiento->estado($usuario));
            return;
        }
        $datos = $peticion->cuerpo();
        $estado = $this->consentimiento->decidir($usuario, $datos['autorizado'] ?? null, $datos['version'] ?? null);
        if (!$estado['autorizado']) $this->servicio->limpiarMemoria();
        RespuestaJson::enviar($estado);
    }

    public function preguntar(Peticion $peticion): void
    {
        $cuerpo = $peticion->cuerpo();
        $pregunta = $peticion->query('pregunta');
        if (!is_string($pregunta) || trim($pregunta) === '') {
            $pregunta = $cuerpo['pregunta'] ?? '';
        }
        $pregunta = is_string($pregunta) ? trim($pregunta) : '';
        if ($pregunta === '') {
            throw new ValidacionException('La pregunta no puede estar vacía.');
        }
        if (mb_strlen($pregunta) > 2000) {
            throw new ValidacionException('La pregunta no puede superar 2000 caracteres.');
        }

        $vista = $peticion->query('vista') ?? ($cuerpo['vista'] ?? null);
        $vista = is_string($vista) ? $vista : null;
        if ($vista !== null && !$this->esVistaValida($vista)) {
            throw new ValidacionException('La vista indicada no es válida.');
        }
        $cultivoIdRaw = $cuerpo['cultivo_id'] ?? null;
        $cultivoId = $this->enteroOpcional($cultivoIdRaw, 'cultivo_id', 1, PHP_INT_MAX);
        $añoRaw = $cuerpo['año'] ?? null;
        $año = $this->enteroOpcional($añoRaw, 'año', 2000, 2100);

        // Es un resumen generado por el frontend del dashboard visible. Se
        // limita su tamaño porque sólo debe complementar, nunca sustituir,
        // los datos que el backend obtiene de la sesión y la base de datos.
        $dashboard = $cuerpo['dashboard'] ?? null;
        if ($dashboard !== null && !is_array($dashboard)) {
            throw new ValidacionException('El contexto del dashboard no es válido.');
        }
        if (is_array($dashboard) && strlen((string) json_encode($dashboard, JSON_UNESCAPED_UNICODE)) > 30000) {
            throw new ValidacionException('El contexto del dashboard es demasiado grande.');
        }

        // Borrador del formulario de Nueva Simulación. No sustituye a la
        // parcela autorizada: sólo aporta los valores que el usuario ve antes
        // de ejecutar el modelo. El servicio valida cada campo y descarta los
        // que no correspondan a la vista "simular".
        $simulacion = $cuerpo['simulacion'] ?? null;
        if ($simulacion !== null && !is_array($simulacion)) {
            throw new ValidacionException('El borrador de simulación no es válido.');
        }
        if (is_array($simulacion) && strlen((string) json_encode($simulacion, JSON_UNESCAPED_UNICODE)) > 8000) {
            throw new ValidacionException('El borrador de simulación es demasiado grande.');
        }

        $usuarioId = $this->usuarioId();
        if (!$this->consentimiento->estado($usuarioId)['autorizado']) {
            RespuestaJson::enviar(['error' => 'Para enviar una consulta al proveedor de IA, autoriza este uso de tus datos.',
                'version' => ConsentimientoAsistente::VERSION], 428);
            return;
        }
        $simple = ($cuerpo['modo_simple'] ?? false) === true;
        $stream = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'text/event-stream');
        $iniciado = false;
        $evento = static function (string $tipo, array $datos) use (&$iniciado): void {
            if (!$iniciado) {
                header('Content-Type: text/event-stream; charset=utf-8');
                header('Cache-Control: private, no-store, no-transform');
                header('X-Accel-Buffering: no');
                if (function_exists('apache_setenv')) apache_setenv('no-gzip', '1');
                while (ob_get_level() > 0 && ob_end_flush()) {}
                $iniciado = true;
            }
            echo 'event: ', $tipo, "\ndata: ", json_encode($datos, JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR), "\n\n";
            flush();
        };
        try {
            $emitir = $stream ? static fn (string $texto) => $evento('delta', ['texto' => $texto]) : null;
            $respuesta = SesionSinBloqueo::ejecutar(
                fn () => $this->servicio->preguntar($pregunta, $vista, $usuarioId, $cultivoId, $año, $dashboard, $simulacion, $emitir, $simple),
                'chat',
            );
            if ($stream) $evento('final', $respuesta);
            else RespuestaJson::enviar($respuesta);
        } catch (\Throwable $error) {
            if (!$iniciado) throw $error;
            $codigo = $error instanceof ZeaSysException ? $error->codigoHttp() : 500;
            $evento('error', ['codigo' => $codigo, 'error' => 'La respuesta se interrumpió.']);
        }
    }

    public function limpiar(Peticion $peticion): void
    {
        $this->servicio->limpiarMemoria();
        RespuestaJson::enviar(['ok' => true]);
    }

    /**
     * Guarda la conversación visible como favorita del usuario. El cuerpo
     * incluye conversacion_id, vista, cultivo_id, año y mensajes; el servicio
     * valida la propiedad de la parcela y normaliza los mensajes.
     */
    public function guardarFavorito(Peticion $peticion): void
    {
        $respuesta = $this->servicio->guardarFavorito($this->usuarioId(), $peticion->cuerpo());
        RespuestaJson::enviar($respuesta, 201);
    }

    public function eliminarFavorito(Peticion $peticion): void
    {
        $cuerpo = $peticion->cuerpo();
        $conversacionId = $cuerpo['conversacion_id'] ?? $peticion->query('conversacion_id');
        if (!is_string($conversacionId) || trim($conversacionId) === '') {
            throw new ValidacionException('El identificador de la conversación es obligatorio.');
        }

        $this->servicio->eliminarFavorito($this->usuarioId(), trim($conversacionId));
        RespuestaJson::enviar(['ok' => true]);
    }

    private function usuarioId(): int
    {
        $usuarioId = (int) ($_SESSION['usuario_id'] ?? 0);
        if ($usuarioId <= 0) {
            throw new NoAutorizadoException('Inicia sesión para usar el asistente.');
        }

        return $usuarioId;
    }

    private function enteroOpcional(mixed $valor, string $campo, int $minimo, int $maximo): ?int
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        $entero = filter_var($valor, FILTER_VALIDATE_INT);
        if ($entero === false || $entero < $minimo || $entero > $maximo) {
            throw new ValidacionException("El campo {$campo} no es válido.");
        }
        return $entero;
    }

    private function esVistaValida(string $vista): bool
    {
        return in_array($vista, self::VISTAS_VALIDAS, true);
    }
}
