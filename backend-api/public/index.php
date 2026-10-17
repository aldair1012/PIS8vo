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

require_once __DIR__ . '/../src/Config/aplicacion.php';
require_once __DIR__ . '/../src/Config/constantes_negocio.php';

ManejadorErrores::registrar();
Cors::aplicar();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_name(SESSION_NAME);
session_start([
    'cookie_lifetime' => 0,
    'cookie_secure'   => false, // desarrollo local
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

error_reporting(E_ALL);
ini_set('display_errors', '1');

// F01: controladores legacy (globales, sin namespace). Se eliminan fase a fase (F02–F05) y en F06 no queda ninguno.
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/CultivoController.php';
require_once __DIR__ . '/../controllers/SimulacionController.php';
require_once __DIR__ . '/../controllers/ScenarioController.php';
require_once __DIR__ . '/../controllers/ClimateController.php';
require_once __DIR__ . '/../controllers/YieldController.php';
require_once __DIR__ . '/../controllers/FinancialController.php';

$contenedor = (require __DIR__ . '/../src/Config/contenedor.php')();
$rutas      = require __DIR__ . '/../src/Config/rutas.php';

$router = new Router($contenedor, $rutas, new AutenticacionMiddleware());
$router->despachar(Peticion::desdeGlobal());
