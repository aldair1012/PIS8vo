<?php
// src/Kernel/Errores/ManejadorErrores.php — Handler global de excepciones → JSON (con fallback mínimo ante fallo propio).
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

final class ManejadorErrores
{
    public static function registrar(): void
    {
        set_exception_handler(static function (\Throwable $e): void {
            try {
                $codigo  = $e instanceof ZeaSysException ? $e->codigoHttp() : 500;
                $mensaje = $e instanceof ZeaSysException
                    ? $e->getMessage()
                    : 'Error interno del servidor: ' . $e->getMessage();

                if (!headers_sent()) {
                    http_response_code($codigo);
                    header('Content-Type: application/json; charset=utf-8');
                }
                echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
            } catch (\Throwable) {
                http_response_code(500);
                echo '{"error":"Error interno del servidor"}';
            }
        });
    }
}
