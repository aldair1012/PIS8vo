<?php
// src/Kernel/AutenticacionMiddleware.php — Autenticación por sesión (401) y cierre selectivo de sesión según el flag 'sesion'.
declare(strict_types=1);

namespace ZeaSys\Kernel;

use ZeaSys\Kernel\Errores\NoAutorizadoException;

final class AutenticacionMiddleware
{
    /**
     * @param array{publica?: bool, sesion?: bool} $definicion
     */
    public function procesar(string $ruta, array $definicion): void
    {
        if (!($definicion['publica'] ?? false) && !isset($_SESSION['usuario_id'])) {
            throw new NoAutorizadoException();
        }
        // Paridad con el index legacy: la sesión abierta se mantiene solo si la ruta declara 'sesion' => true.
        $mantieneSesion = (bool) ($definicion['sesion'] ?? false);
        if (!$mantieneSesion) {
            session_write_close();
        }
    }
}
