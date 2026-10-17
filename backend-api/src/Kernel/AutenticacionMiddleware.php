<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

use ZeaSys\Kernel\Errores\NoAutorizadoException;

final class AutenticacionMiddleware
{
    /** Rutas que requieren la sesión ABIERTA (no se llama session_write_close). Idéntico al index original. */
    private const RUTAS_QUE_MANTIENEN_SESION = [
        'api/auth/login',
        'api/auth/register',
        'api/auth/google-login',
        'api/auth/logout',
        'api/auth/update',
        'api/auth/delete',
        'api/auth/upload-avatar',
        'api/auth/delete-avatar',
    ];

    /**
     * @param array{publica?: bool} $definicion
     */
    public function procesar(string $ruta, array $definicion): void
    {
        if (!($definicion['publica'] ?? false) && !isset($_SESSION['usuario_id'])) {
            throw new NoAutorizadoException();
        }
        if (!in_array($ruta, self::RUTAS_QUE_MANTIENEN_SESION, true)) {
            session_write_close();
        }
    }
}
