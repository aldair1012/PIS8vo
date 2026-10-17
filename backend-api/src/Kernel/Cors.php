<?php
// src/Kernel/Cors.php — Cabeceras CORS (reflejo del Origin con credenciales), idénticas al index legacy.
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Cors
{
    public static function aplicar(): void
    {
        $allowedOrigin = 'http://localhost:5173';
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            $origin = $_SERVER['HTTP_ORIGIN'];
            if (preg_match('/^https?:\/\//', $origin)) {
                $allowedOrigin = $origin;
            }
        }
        header("Access-Control-Allow-Origin: {$allowedOrigin}");
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    }
}
