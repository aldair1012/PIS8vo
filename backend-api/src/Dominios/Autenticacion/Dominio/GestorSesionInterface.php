<?php
// src/Dominios/Autenticacion/Dominio/GestorSesionInterface.php — Contrato del gestor de sesión de autenticación.
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

    /**
     * Reemite la cookie de sesión con lifetime de 30 días (2592000 s) si $recordar, 0 si no.
     * Bloque verbatim de login()/googleLogin() legacy — headers byte-idénticos.
     */
    public function extenderCookie(bool $recordar): void;
}
