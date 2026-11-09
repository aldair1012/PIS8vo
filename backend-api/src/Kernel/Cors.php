<?php
// src/Kernel/Cors.php — CORS restringido a los orígenes locales de desarrollo.
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Cors
{
    public static function permiteOrigen(string $origin): bool
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
        $https = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') || (string)($_SERVER['SERVER_PORT'] ?? '') === '443';
        $host = (string)($_SERVER['HTTP_HOST'] ?? '');
        $sameOrigin = ($https ? 'https://' : 'http://') . $host;
        return ($host !== '' && $origin === $sameOrigin) || in_array($origin, $allowedOrigins, true);
    }

    public static function verificarEscritura(): void
    {
        if (in_array(strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')), ['GET', 'HEAD', 'OPTIONS'], true)) return;
        $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
        if ($origin === null && isset($_SERVER['HTTP_REFERER'])) {
            $parts = parse_url((string)$_SERVER['HTTP_REFERER']);
            $origin = is_array($parts) && isset($parts['scheme'], $parts['host'])
                ? $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '') : 'null';
        }
        if (($origin !== null && (!is_string($origin) || !self::permiteOrigen($origin)))
            || ($origin === null && ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site')) {
            throw new \ZeaSys\Kernel\Errores\AccesoDenegadoException('El origen de la solicitud no está permitido.');
        }
    }

    public static function aplicar(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
        header('Vary: Origin');

        if (!is_string($origin) || !self::permiteOrigen($origin)) {
            return;
        }

        header("Access-Control-Allow-Origin: {$origin}");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    }
}
