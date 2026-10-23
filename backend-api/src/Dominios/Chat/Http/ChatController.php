<?php
// src/Dominios/Chat/Http/ChatController.php — Controlador delgado del chatbot.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Http;

use ZeaSys\Dominios\Chat\Aplicacion\ChatService;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class ChatController
{
    public function __construct(private ChatService $servicio) {}

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
        if ($vista !== null && mb_strlen($vista) > 50) {
            throw new ValidacionException('La vista indicada no es válida.');
        }
        $cultivoIdRaw = $cuerpo['cultivo_id'] ?? null;
        $cultivoId = $this->enteroOpcional($cultivoIdRaw, 'cultivo_id', 1, PHP_INT_MAX);
        $anioRaw = $cuerpo['anio'] ?? null;
        $anio = $this->enteroOpcional($anioRaw, 'anio', 2000, 2100);

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

        $usuarioId = (int) ($_SESSION['usuario_id'] ?? 0);

        $respuesta = $this->servicio->preguntar($pregunta, $vista, $usuarioId, $cultivoId, $anio, $dashboard, $simulacion);

        RespuestaJson::enviar($respuesta);
    }

    public function limpiar(Peticion $peticion): void
    {
        $this->servicio->limpiarMemoria();
        RespuestaJson::enviar(['ok' => true]);
    }

    /**
     * Guarda la conversación visible como favorita del usuario. El cuerpo
     * incluye conversacion_id, vista, cultivo_id, anio y mensajes; el servicio
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
}
