<?php
// src/Config/rutas.php — Tabla declarativa de rutas del API.
// F01: controladores legacy (id = nombre de clase global). F02–F05 los reemplazan dominio a dominio.

return [
    // --- Autenticación (F02: dominio ZeaSys\Dominios\Autenticacion) ---
    'api/auth/iniciar-sesion'               => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'iniciarSesion', 'metodos' => ['POST'], 'publica' => true, 'sesion' => true],
    'api/auth/registrarse'                  => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'registrarse', 'metodos' => ['POST'], 'publica' => true, 'sesion' => true],
    'api/auth/google-iniciar-sesion'        => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'iniciarSesionGoogle', 'metodos' => ['POST'], 'publica' => true, 'sesion' => true],
    'api/auth/yo'                           => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'yo', 'metodos' => ['GET'], 'publica' => true],
    'api/auth/cerrar-sesion'                => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'cerrarSesion', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/actualizar'                   => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'actualizar', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/subir-avatar'                 => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'subirAvatar', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/eliminar-avatar'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'eliminarAvatar', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/sincronizar-avatar-google'    => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'sincronizarAvatarGoogle', 'metodos' => ['POST'], 'sesion' => true],
    'api/auth/eliminar-cuenta'              => ['controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class, 'accion' => 'eliminarCuenta', 'metodos' => ['POST'], 'sesion' => true],

    // --- Cultivos / Parcelas (F03: dominio ZeaSys\Dominios\Lotes) ---
    'api/parcelas'                          => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'acciones' => ['GET' => 'listar', 'POST' => 'crear', 'PUT' => 'actualizar', 'DELETE' => 'eliminar']],
    'api/parcelas/mapa'                     => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'accion' => 'mapa', 'metodos' => ['GET']],
    'api/parcelas/valores-ubicacion'        => ['controlador' => \ZeaSys\Dominios\Lotes\Http\CultivoController::class, 'accion' => 'obtenerValoresUbicacion', 'metodos' => ['GET']],

    // --- Simulaciones (F04: dominio ZeaSys\Dominios\Simulaciones) ---
    'api/simulaciones/simular'              => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'simular', 'metodos' => ['POST']],
    'api/simulaciones/evaluar-variedades'   => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'evaluarVariedades', 'metodos' => ['POST']],
    'api/simulaciones/historial'            => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'historial', 'metodos' => ['GET']],
    'api/simulaciones/eliminar'             => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'eliminar', 'metodos' => ['DELETE']],
    'api/simulaciones/estado-ia'            => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'estadoIA', 'metodos' => ['GET']],
    'api/simulaciones/explicar'             => ['controlador' => \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class, 'accion' => 'explicar', 'metodos' => ['POST']],

    // --- Chat: chatbot con memoria de sesión ---
    'api/chat/preguntar'                    => ['controlador' => \ZeaSys\Dominios\Chat\Http\ChatController::class, 'accion' => 'preguntar', 'metodos' => ['POST'], 'sesion' => true],
    'api/chat/limpiar'                      => ['controlador' => \ZeaSys\Dominios\Chat\Http\ChatController::class, 'accion' => 'limpiar', 'metodos' => ['POST'], 'sesion' => true],
    'api/chat/favorito'                     => ['controlador' => \ZeaSys\Dominios\Chat\Http\ChatController::class, 'accion' => 'guardarFavorito', 'metodos' => ['POST'], 'sesion' => true],
    'api/chat/favorito/eliminar'            => ['controlador' => \ZeaSys\Dominios\Chat\Http\ChatController::class, 'accion' => 'eliminarFavorito', 'metodos' => ['POST'], 'sesion' => true],

    // --- DSS Dashboards (F05: dominio ZeaSys\Dominios\Analitica) ---
    'api/escenarios'                        => ['controlador' => \ZeaSys\Dominios\Analitica\Http\ScenarioController::class, 'accion' => 'index', 'metodos' => ['GET']],
    'api/clima'                             => ['controlador' => \ZeaSys\Dominios\Analitica\Http\ClimateController::class, 'accion' => 'index', 'metodos' => ['GET']],
    'api/rendimiento'                       => ['controlador' => \ZeaSys\Dominios\Analitica\Http\YieldController::class, 'accion' => 'index', 'metodos' => ['GET']],
    'api/rendimiento/mediciones/consulta'   => ['controlador' => \ZeaSys\Dominios\Analitica\Http\YieldController::class, 'accion' => 'obtenerMediciones', 'metodos' => ['GET']],
    'api/rendimiento/mediciones'            => ['controlador' => \ZeaSys\Dominios\Analitica\Http\YieldController::class, 'accion' => 'guardarMediciones', 'metodos' => ['POST']],
    'api/financiero'                        => ['controlador' => \ZeaSys\Dominios\Analitica\Http\FinancialController::class, 'accion' => 'index', 'metodos' => ['GET']],
];
