<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface GestorSesionInterface
{
    /** @param array{id: int|string, nombre: string, correo: string} $usuario */
    public function iniciar(array $usuario): void;

    /** Idéntico al logout actual: session_destroy() + session_start(). */
    public function cerrar(): void;

    public function usuarioId(): ?int;

    public function actualizarNombre(string $nombre): void;
}
