<?php
// src/Kernel/Cors.php — CORS restringido a los orígenes locales de desarrollo.
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Cors
{
    public static function aplicar(): void
    {
        $allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5500',
            'http://localhost:5501',
            'http://127.0.0.1:5500',
            'http://127.0.0.1:5501',
        ];
        $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
        header('Vary: Origin');

        if (!is_string($origin) || !in_array($origin, $allowedOrigins, true)) {
            return;
        }

        header("Access-Control-Allow-Origin: {$origin}");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    }
}
