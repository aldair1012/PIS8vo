<?php
// src/Config/contenedor.php — Bindings del contenedor DI.
// F01: controladores legacy. F02–F05 añaden los bindings de cada dominio nuevo.
// Nota: el binding de UsuarioRepositoryMysql depende del global legado getConnection() — puente transitorio, fuera en F06.

use ZeaSys\Kernel\Container;

return static function (): Container {
    $contenedor = new Container();

    require_once __DIR__ . '/google.php';

    $contenedor->registrar(
        \ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface::class,
        static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\UsuarioRepositoryMysql =>
            new \ZeaSys\Dominios\Autenticacion\Infraestructura\UsuarioRepositoryMysql(getConnection())
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface::class,
        static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\VerificadorTokenGoogle =>
            new \ZeaSys\Dominios\Autenticacion\Infraestructura\VerificadorTokenGoogle()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface::class,
        static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\AlmacenAvatarArchivos =>
            new \ZeaSys\Dominios\Autenticacion\Infraestructura\AlmacenAvatarArchivos()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface::class,
        static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\GestorSesion =>
            new \ZeaSys\Dominios\Autenticacion\Infraestructura\GestorSesion()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService::class,
        static fn (Container $c): \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService =>
            new \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService(
                $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface::class),
                $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface::class),
                $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Autenticacion\Http\AuthController::class,
        static fn (Container $c): \ZeaSys\Dominios\Autenticacion\Http\AuthController =>
            new \ZeaSys\Dominios\Autenticacion\Http\AuthController(
                $c->get(\ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService::class)
            )
    );

    $legacy = [
        'CultivoController',
        'SimulacionController',
        'ScenarioController',
        'ClimateController',
        'YieldController',
        'FinancialController',
    ];
    foreach ($legacy as $clase) {
        $contenedor->registrar($clase, static fn (): object => new $clase());
    }

    return $contenedor;
};
