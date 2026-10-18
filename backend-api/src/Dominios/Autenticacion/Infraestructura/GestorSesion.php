<?php
// src/Dominios/Autenticacion/Infraestructura/GestorSesion.php — Sesión: claves de usuario, cierre y extensión de cookie.
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface;

final class GestorSesion implements GestorSesionInterface
{
    public function iniciar(array $usuario): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('No hay una sesión activa para autenticar al usuario.');
        }
        if (!session_regenerate_id(true)) {
            throw new \RuntimeException('No se pudo renovar la sesión de usuario.');
        }
        $_SESSION['usuario_id'] = (int) $usuario['id'];
        $_SESSION['nombre']     = $usuario['nombre'];
        $_SESSION['correo']     = $usuario['correo'];
        $_SESSION['ultima_actividad'] = time();
        $_SESSION['recordar'] = false;
    }

    public function cerrar(): void
    {
        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires'  => time() - 42000,
                'path'     => $params['path'],
                'domain'   => $params['domain'],
                'secure'   => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }

        session_destroy();
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
        $_SESSION['recordar'] = $recordar;
        $_SESSION['ultima_actividad'] = time();
        $sessionName = session_name();
        $sessionId = session_id();
        $params = session_get_cookie_params();
        $lifetime = $recordar ? 2592000 : 0;

        setcookie($sessionName, $sessionId, [
            'expires'  => $lifetime > 0 ? time() + $lifetime : 0,
            'path'     => $params['path'],
            'domain'   => $params['domain'],
            'secure'   => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }
}
