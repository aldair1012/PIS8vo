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

    // --- Cultivos / Parcelas (F03: dominio ZeaSys\Dominios\Lotes) ---
    'api/cultivos'                 => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'acciones' => ['GET' => 'listar', 'POST' => 'crear', 'PUT' => 'actualizar', 'DELETE' => 'eliminar']],
    'api/cultivos/mapa'            => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'accion' => 'mapa'],
    'api/cultivos/valores-ubicacion' => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'accion' => 'obtenerValoresUbicacion'],

    // --- Simulaciones (F04: dominio ZeaSys\Dominios\Simulaciones) ---
    'api/simulaciones/simular'     => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'simular'],
    'api/simulaciones/historial'   => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'historial'],
    'api/simulaciones/eliminar'    => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'eliminar'],
    'api/simulaciones/ia-status'   => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'iaStatus', 'publica' => true],
    'api/simulaciones/explain'     => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'explain'],

    // --- DSS Dashboards (F05: dominio ZeaSys\Dominios\Analitica) ---
    'api/scenarios'                => ['controlador' => \ZeaSys\Dominios\Analitica\Http\ScenarioController::class, 'accion' => 'index'],
    'api/yield'                    => ['controlador' => \ZeaSys\Dominios\Analitica\Http\YieldController::class, 'accion' => 'index'],
    'api/financial'                => ['controlador' => \ZeaSys\Dominios\Analitica\Http\FinancialController::class, 'accion' => 'index'],
    // Climate queda legacy hasta F05 Task 17 (switch final + limpieza)
    'api/climate'                  => ['controlador' => 'ClimateController', 'accion' => 'index'],
];
