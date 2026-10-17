<?php
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
}
