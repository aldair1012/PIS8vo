<?php
// src/Dominios/Autenticacion/Infraestructura/GestorSesion.php — Sesión: claves de usuario, cierre y extensión de cookie.
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface;

final class GestorSesion implements GestorSesionInterface
{
    public function iniciar(array $usuario): void
    {
        $_SESSION['usuario_id'] = (int) $usuario['id'];
        $_SESSION['nombre']     = $usuario['nombre'];
        $_SESSION['correo']     = $usuario['correo'];
    }

    public function cerrar(): void
    {
        session_destroy();
        session_start();
    }

    public function usuarioId(): ?int
    {
        return isset($_SESSION['usuario_id']) ? (int) $_SESSION['usuario_id'] : null;
    }

    public function actualizarNombre(string $nombre): void
    {
        $_SESSION['nombre'] = $nombre;
    }

    public function extenderCookie(bool $recordar): void
    {
        $sessionName = session_name();
        $sessionId = session_id();
        $params = session_get_cookie_params();
        $lifetime = $recordar ? 2592000 : 0;

        setcookie(
            $sessionName,
            $sessionId,
            $lifetime > 0 ? time() + $lifetime : 0,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
}
