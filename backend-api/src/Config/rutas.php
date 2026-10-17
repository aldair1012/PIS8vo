<?php
// src/Config/rutas.php — Tabla declarativa de rutas del API.
// F01: controladores legacy (id = nombre de clase global). F02–F05 los reemplazan dominio a dominio.

return [
    // --- Autenticación (F02: dominio ZeaSys\Dominios\Autenticacion) ---
    'api/auth/login'               => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'login', 'publica' => true, 'sesion' => true],
    'api/auth/register'            => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'registro', 'publica' => true, 'sesion' => true],
    'api/auth/google-login'        => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'googleLogin', 'publica' => true, 'sesion' => true],
    'api/auth/me'                  => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'me', 'publica' => true],
    'api/auth/logout'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'logout', 'sesion' => true],
    'api/auth/update'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'update', 'sesion' => true],
    'api/auth/upload-avatar'       => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'uploadAvatar', 'sesion' => true],
    'api/auth/delete-avatar'       => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'deleteAvatar', 'sesion' => true],
    'api/auth/sync-google-avatar'  => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'syncGoogleAvatar'],
    'api/auth/delete'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'eliminar', 'sesion' => true],

    // --- Cultivos / Parcelas ---
    'api/cultivos'                 => ['controlador' => 'CultivoController', 'acciones' => ['GET' => 'listar', 'POST' => 'crear', 'PUT' => 'actualizar', 'DELETE' => 'eliminar']],
    'api/cultivos/mapa'            => ['controlador' => 'CultivoController', 'accion' => 'mapa'],
    'api/cultivos/valores-ubicacion' => ['controlador' => 'CultivoController', 'accion' => 'obtenerValoresUbicacion'],

    // --- Simulaciones ---
    'api/simulaciones/simular'     => ['controlador' => 'SimulacionController', 'accion' => 'simular'],
    'api/simulaciones/historial'   => ['controlador' => 'SimulacionController', 'accion' => 'historial'],
    'api/simulaciones/eliminar'    => ['controlador' => 'SimulacionController', 'accion' => 'eliminar'],
    'api/simulaciones/ia-status'   => ['controlador' => 'SimulacionController', 'accion' => 'iaStatus', 'publica' => true],
    'api/simulaciones/explain'     => ['controlador' => 'SimulacionController', 'accion' => 'explain'],

    // --- DSS Dashboards ---
    'api/scenarios'                => ['controlador' => 'ScenarioController', 'accion' => 'index'],
    'api/climate'                  => ['controlador' => 'ClimateController', 'accion' => 'index'],
    'api/yield'                    => ['controlador' => 'YieldController', 'accion' => 'index'],
    'api/financial'                => ['controlador' => 'FinancialController', 'accion' => 'index'],
];
