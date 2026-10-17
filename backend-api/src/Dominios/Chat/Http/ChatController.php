<?php
// src/Dominios/Chat/Http/ChatController.php — Controlador delgado del chatbot.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Http;

use ZeaSys\Dominios\Chat\Aplicacion\ChatService;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class ChatController
{
    public function __construct(private ChatService $servicio) {}

    public function preguntar(Peticion $peticion): void
    {
        $pregunta = trim($peticion->query('pregunta') ?? '');
        if ($pregunta === '') {
            $cuerpo = $peticion->cuerpo();
            $pregunta = trim($cuerpo['pregunta'] ?? '');
        }
        if ($pregunta === '') {
            throw new ValidacionException('La pregunta no puede estar vacía.');
        }

        $vista = $peticion->query('vista') ?? $peticion->cuerpo()['vista'] ?? null;

        $usuarioId = (int) ($_SESSION['usuario_id'] ?? 0);

        $respuesta = $this->servicio->preguntar($pregunta, $vista, $usuarioId);

        RespuestaJson::enviar($respuesta);
    }
}