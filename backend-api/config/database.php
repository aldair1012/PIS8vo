<?php
// Configuración de la base de datos local (MySQL via XAMPP).

define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_NAME', 'agropredict_db');
define('DB_USER', 'root');
define('DB_PASS', '');

define('IA_SERVER_URL', 'http://127.0.0.1:5000');

define('PRECIO_MAIZ_TON', 178); // USD/ton
define('PRECIO_MAIZ_FUENTE', 'MAG 2024');

// Configuración de Sesión
define('SESSION_NAME', 'AGROPREDICT_SESSION');
define('SESSION_LIFETIME', 3600); // 1 hora

function getConnection(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            DB_HOST,
            DB_PORT,
            DB_NAME
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'error'   => true,
                'message' => 'Error de conexión a la base de datos local: ' . $e->getMessage()
            ]);
            exit;
        }
    }

    return $pdo;
}
