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

require_once __DIR__ . '/../src/Config/aplicacion.php';
require_once __DIR__ . '/../src/Config/constantes_negocio.php';

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
// F02: la autenticación ahora se enruta al dominio nuevo (src/Config/rutas.php, Fase F02 del plan).
// F03: los cultivos ahora se enrutan al dominio Lotes (src/Config/rutas.php, Fase F03 del plan).
// F04: las simulaciones ahora se enrutan al dominio Simulaciones (src/Config/rutas.php, Fase F04 del plan).
// F05: los 4 dashboards DSS ahora se enrutan al dominio Analítica (src/Config/rutas.php, Fase F05 del plan).
// Los 4 controladores legacy fueron retirados con git rm en F05 Task 17.

$contenedor = (require __DIR__ . '/../src/Config/contenedor.php')();
$rutas      = require __DIR__ . '/../src/Config/rutas.php';

$router = new Router($contenedor, $rutas, new AutenticacionMiddleware());
$router->despachar(Peticion::desdeGlobal());
