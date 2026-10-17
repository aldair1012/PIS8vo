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

    // --- Terreno (F03): datos de clima/suelo con caché de archivos ---
    $contenedor->registrar(
        \ZeaSys\Dominios\Terreno\Dominio\CacheInterface::class,
        static fn (): \ZeaSys\Dominios\Terreno\Infraestructura\CacheArchivos =>
            new \ZeaSys\Dominios\Terreno\Infraestructura\CacheArchivos()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface::class,
        static fn (): \ZeaSys\Dominios\Terreno\Infraestructura\ProveedorOpenMeteo =>
            new \ZeaSys\Dominios\Terreno\Infraestructura\ProveedorOpenMeteo()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface::class,
        static fn (): \ZeaSys\Dominios\Terreno\Infraestructura\ProveedorSoilGrids =>
            new \ZeaSys\Dominios\Terreno\Infraestructura\ProveedorSoilGrids()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno::class,
        static fn (Container $c): \ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno =>
            new \ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno(
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\CacheInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface::class),
            )
    );

    // --- Lotes (F03): cultivos/parcelas ---
    $contenedor->registrar(
        \ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class,
        static fn (): \ZeaSys\Dominios\Lotes\Infraestructura\CultivoRepositoryMysql =>
            new \ZeaSys\Dominios\Lotes\Infraestructura\CultivoRepositoryMysql(getConnection())
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Lotes\Dominio\ValidadorLimitesEcuador::class,
        static fn (): \ZeaSys\Dominios\Lotes\Dominio\ValidadorLimitesEcuador =>
            new \ZeaSys\Dominios\Lotes\Dominio\ValidadorLimitesEcuador()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Lotes\Aplicacion\CultivoService::class,
        static fn (Container $c): \ZeaSys\Dominios\Lotes\Aplicacion\CultivoService =>
            new \ZeaSys\Dominios\Lotes\Aplicacion\CultivoService(
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\ValidadorLimitesEcuador::class),
                $c->get(\ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Lotes\Http\CultivoController::class,
        static fn (Container $c): \ZeaSys\Dominios\Lotes\Http\CultivoController =>
            new \ZeaSys\Dominios\Lotes\Http\CultivoController(
                $c->get(\ZeaSys\Dominios\Lotes\Aplicacion\CultivoService::class)
            )
    );

    $legacy = [
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
