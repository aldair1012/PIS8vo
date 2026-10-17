<?php
// src/Config/rutas.php — Tabla declarativa de rutas del API.
// F01: controladores legacy (id = nombre de clase global). F02–F05 los reemplazan dominio a dominio.

return [
    // --- Autenticación ---
    'api/auth/login'               => ['controlador' => 'AuthController', 'accion' => 'login', 'publica' => true],
    'api/auth/register'            => ['controlador' => 'AuthController', 'accion' => 'registro', 'publica' => true],
    'api/auth/google-login'        => ['controlador' => 'AuthController', 'accion' => 'googleLogin', 'publica' => true],
    'api/auth/me'                  => ['controlador' => 'AuthController', 'accion' => 'me', 'publica' => true],
    'api/auth/logout'              => ['controlador' => 'AuthController', 'accion' => 'logout'],
    'api/auth/update'              => ['controlador' => 'AuthController', 'accion' => 'update'],
    'api/auth/upload-avatar'       => ['controlador' => 'AuthController', 'accion' => 'uploadAvatar'],
    'api/auth/delete-avatar'       => ['controlador' => 'AuthController', 'accion' => 'deleteAvatar'],
    'api/auth/sync-google-avatar'  => ['controlador' => 'AuthController', 'accion' => 'syncGoogleAvatar'],
    'api/auth/delete'              => ['controlador' => 'AuthController', 'accion' => 'eliminar'],

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
