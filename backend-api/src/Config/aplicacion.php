<?php
// src/Config/aplicacion.php — Infraestructura: base de datos, motor IA y sesión.
// Sin declare(strict_types=1) a propósito: shim en contexto legacy (paridad bit a bit).

define('DB_HOST', getenv('ZEASYS_DB_HOST') ?: '127.0.0.1');
define('DB_PORT', (int) (getenv('ZEASYS_DB_PORT') ?: 3306));
define('DB_NAME', getenv('ZEASYS_DB_NAME') ?: 'agropredict_db');
define('DB_USER', getenv('ZEASYS_DB_USER') ?: 'root');
define('DB_PASS', getenv('ZEASYS_DB_PASS') ?: '');

define('IA_SERVER_URL', getenv('ZEASYS_IA_SERVER_URL') ?: 'http://127.0.0.1:5000');

define('FLOWISE_URL', getenv('ZEASYS_FLOWISE_URL') ?: 'http://127.0.0.1:3000');
// El ID del chatflow no es una credencial. Se conserva un valor local de
// respaldo porque Apache/PHP no siempre hereda las variables de entorno
// creadas con `setx` hasta reiniciar el proceso de Apache.
define('FLOWISE_CHATFLOW_ID', getenv('ZEASYS_FLOWISE_CHATFLOW_ID') ?: '27d477e0-66b5-4a51-aba0-dcfaf80728c1');
define('FLOWISE_API_KEY', getenv('ZEASYS_FLOWISE_API_KEY') ?: '');

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
            error_log('[ZeaSys] Error de conexión a base de datos: ' . $e->getMessage());
            throw new RuntimeException('No se pudo conectar con la base de datos.', 0, $e);
        }
    }

    return $pdo;
}
