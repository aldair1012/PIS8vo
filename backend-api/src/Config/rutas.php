<?php
// src/Config/rutas.php — Tabla declarativa de rutas del API.
// F01: controladores legacy (id = nombre de clase global). F02–F05 los reemplazan dominio a dominio.

return [
    // --- Autenticación (F02: dominio ZeaSys\Dominios\Autenticacion) ---
    'api/auth/login'               => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'login', 'metodos' => ['POST'], 'publica' => true, 'sesion' => true],
    'api/auth/register'            => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'registro', 'metodos' => ['POST'], 'publica' => true, 'sesion' => true],
    'api/auth/google-login'        => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'googleLogin', 'metodos' => ['POST'], 'publica' => true, 'sesion' => true],
    'api/auth/me'                  => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'me', 'metodos' => ['GET'], 'publica' => true],
    'api/auth/logout'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'logout', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/update'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'update', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/upload-avatar'       => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'uploadAvatar', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/delete-avatar'       => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'deleteAvatar', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/sync-google-avatar'  => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'syncGoogleAvatar', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/delete'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'eliminar', 'metodos' => ['POST'], 'sesion' => true],

    // --- Cultivos / Parcelas (F03: dominio ZeaSys\Dominios\Lotes) ---
    'api/cultivos'                 => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'acciones' => ['GET' => 'listar', 'POST' => 'crear', 'PUT' => 'actualizar', 'DELETE' => 'eliminar']],
    'api/cultivos/mapa'            => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'accion' => 'mapa', 'metodos' => ['GET']],
    'api/cultivos/valores-ubicacion' => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'accion' => 'obtenerValoresUbicacion', 'metodos' => ['GET']],

    // --- Simulaciones (F04: dominio ZeaSys\Dominios\Simulaciones) ---
    'api/simulaciones/simular'     => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'simular', 'metodos' => ['POST']],
    'api/simulaciones/historial'   => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'historial', 'metodos' => ['GET']],
    'api/simulaciones/eliminar'    => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'eliminar', 'metodos' => ['DELETE']],
    'api/simulaciones/ia-status'   => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'iaStatus', 'metodos' => ['GET']],
    'api/simulaciones/explain'     => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'explain', 'metodos' => ['POST']],

    // --- Chat (Subproyecto 2): chatbot con memoria de sesion ---
    'api/chat/preguntar'           => ['controlador' => \ZeaSys\Dominios\Chat\Http\ChatController::class, 'accion' => 'preguntar', 'metodos' => ['POST'], 'sesion' => true],
    'api/chat/limpiar'             => ['controlador' => \ZeaSys\Dominios\Chat\Http\ChatController::class, 'accion' => 'limpiar', 'metodos' => ['POST'], 'sesion' => true],

    // --- DSS Dashboards (F05: dominio ZeaSys\Dominios\Analitica) ---
    'api/scenarios'                => ['controlador' => \ZeaSys\Dominios\Analitica\Http\ScenarioController::class, 'accion' => 'index', 'metodos' => ['GET']],
    'api/climate'                  => ['controlador' => \ZeaSys\Dominios\Analitica\Http\ClimateController::class, 'accion' => 'index', 'metodos' => ['GET']],
    'api/yield'                    => ['controlador' => \ZeaSys\Dominios\Analitica\Http\YieldController::class, 'accion' => 'index', 'metodos' => ['GET']],
    'api/financial'                => ['controlador' => \ZeaSys\Dominios\Analitica\Http\FinancialController::class, 'accion' => 'index', 'metodos' => ['GET']],
];
