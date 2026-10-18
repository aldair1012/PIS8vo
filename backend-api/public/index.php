<?php
// public/index.php — Front controller de ZeaSys (delgado).
declare(strict_types=1);

use ZeaSys\Kernel\AutenticacionMiddleware;
use ZeaSys\Kernel\AutoloaderPsr4;
use ZeaSys\Kernel\Cors;
use ZeaSys\Kernel\Errores\ManejadorErrores;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\Router;

require __DIR__ . '/../src/Kernel/AutoloaderPsr4.php';
AutoloaderPsr4::registrar(__DIR__ . '/../src');

ManejadorErrores::registrar();
header_remove('X-Powered-By');

require_once __DIR__ . '/../src/Config/aplicacion.php';
require_once __DIR__ . '/../src/Config/constantes_negocio.php';

Cors::aplicar();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_name(SESSION_NAME);
$esHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
    || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', (string) 2592000);
session_start([
    'cookie_lifetime' => 0,
    'cookie_secure'   => $esHttps,
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

$debug = getenv('ZEASYS_DEBUG') === '1';
error_reporting(E_ALL);
ini_set('display_errors', $debug ? '1' : '0');

$contenedor = (require __DIR__ . '/../src/Config/contenedor.php')();
$rutas      = require __DIR__ . '/../src/Config/rutas.php';

$router = new Router($contenedor, $rutas, new AutenticacionMiddleware());
$router->despachar(Peticion::desdeGlobal());
