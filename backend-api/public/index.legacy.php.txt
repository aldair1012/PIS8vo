<?php

// Configuración de CORS para comunicarse con el SPA de React
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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Configuración de Sesión
session_name('AGROPREDICT_SESSION');
session_start([
    'cookie_lifetime' => 0,
    'cookie_secure'   => false, // desarrollo local
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax'
]);

// Manejo de Errores
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Cargar controladores necesarios
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/CultivoController.php';
require_once __DIR__ . '/../controllers/SimulacionController.php';
require_once __DIR__ . '/../controllers/ScenarioController.php';
require_once __DIR__ . '/../controllers/ClimateController.php';
require_once __DIR__ . '/../controllers/YieldController.php';
require_once __DIR__ . '/../controllers/FinancialController.php';

// Obtener ruta solicitada
$route = $_GET['action'] ?? '';
if (empty($route)) {
    $route = $_SERVER['PATH_INFO'] ?? '';
    if (empty($route)) {
        $uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $pos = strpos($uriPath, 'index.php');
        if ($pos !== false) {
            $route = substr($uriPath, $pos + 9);
        } else {
            $posApi = strpos($uriPath, '/api/');
            if ($posApi !== false) {
                $route = substr($uriPath, $posApi);
            }
        }
    }
}
$route = trim($route, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Middleware de Autenticación
$publicRoutes = ['api/auth/login', 'api/auth/register', 'api/auth/google-login', 'api/auth/me', 'api/simulaciones/ia-status'];
if (!in_array($route, $publicRoutes) && !isset($_SESSION['usuario_id'])) {
    // Si la ruta comienza con api/ y no está autenticada, devolver 401
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'No autorizado. Debe iniciar sesión.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!in_array($route, ['api/auth/login', 'api/auth/register', 'api/auth/google-login', 'api/auth/logout', 'api/auth/update', 'api/auth/delete', 'api/auth/upload-avatar', 'api/auth/delete-avatar'])) {
    session_write_close();
}

try {
    switch ($route) {
        // --- Autenticación ---
        case 'api/auth/login':
            $ctrl = new AuthController();
            $ctrl->login();
            break;

        case 'api/auth/register':
            $ctrl = new AuthController();
            $ctrl->registro();
            break;

        case 'api/auth/google-login':
            $ctrl = new AuthController();
            $ctrl->googleLogin();
            break;

        case 'api/auth/logout':
            $ctrl = new AuthController();
            $ctrl->logout();
            break;

        case 'api/auth/me':
            $ctrl = new AuthController();
            $ctrl->me();
            break;

        case 'api/auth/update':
            $ctrl = new AuthController();
            $ctrl->update();
            break;

        case 'api/auth/upload-avatar':
            $ctrl = new AuthController();
            $ctrl->uploadAvatar();
            break;

        case 'api/auth/delete-avatar':
            $ctrl = new AuthController();
            $ctrl->deleteAvatar();
            break;

        case 'api/auth/sync-google-avatar':
            $ctrl = new AuthController();
            $ctrl->syncGoogleAvatar();
            break;

        case 'api/auth/delete':
            $ctrl = new AuthController();
            $ctrl->eliminar();
            break;

        // --- Cultivos / Parcelas ---
        case 'api/cultivos':
            $ctrl = new CultivoController();
            if ($method === 'GET') {
                $ctrl->listar();
            } elseif ($method === 'POST') {
                $ctrl->crear();
            } elseif ($method === 'PUT') {
                $ctrl->actualizar();
            } elseif ($method === 'DELETE') {
                $ctrl->eliminar();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Método no permitido.'], JSON_UNESCAPED_UNICODE);
            }
            break;

        case 'api/cultivos/mapa':
            $ctrl = new CultivoController();
            $ctrl->mapa();
            break;

        case 'api/cultivos/valores-ubicacion':
            $ctrl = new CultivoController();
            $ctrl->obtenerValoresUbicacion();
            break;

        // --- Simulaciones ---
        case 'api/simulaciones/simular':
            $ctrl = new SimulacionController();
            $ctrl->simular();
            break;

        case 'api/simulaciones/historial':
            $ctrl = new SimulacionController();
            $ctrl->historial();
            break;

        case 'api/simulaciones/eliminar':
            $ctrl = new SimulacionController();
            $ctrl->eliminar();
            break;

        case 'api/simulaciones/ia-status':
            $ctrl = new SimulacionController();
            $ctrl->iaStatus();
            break;

        case 'api/simulaciones/explain':
            $ctrl = new SimulacionController();
            $ctrl->explain();
            break;

        // --- DSS Dashboards ---
        case 'api/scenarios':
            $ctrl = new ScenarioController();
            $ctrl->index();
            break;

        case 'api/climate':
            $ctrl = new ClimateController();
            $ctrl->index();
            break;

        case 'api/yield':
            $ctrl = new YieldController();
            $ctrl->index();
            break;

        case 'api/financial':
            $ctrl = new FinancialController();
            $ctrl->index();
            break;

        default:
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => "Ruta no encontrada: {$route}"], JSON_UNESCAPED_UNICODE);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Error interno del servidor: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
