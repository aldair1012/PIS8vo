<?php
// src/Config/contenedor.php — Bindings del contenedor DI.
// F01: controladores legacy. F02–F05 añaden los bindings de cada dominio nuevo.
// Nota: los bindings de UsuarioRepositoryMysql, AltitudMysql y CultivoRepositoryMysql dependen del
// global legado getConnection() — puentes transitorios (ADR-07), fuera en F06.

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
        \ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaActualInterface::class,
        static fn (): \ZeaSys\Dominios\Terreno\Infraestructura\ProveedorOpenMeteoForecast =>
            new \ZeaSys\Dominios\Terreno\Infraestructura\ProveedorOpenMeteoForecast()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Terreno\Dominio\AltitudPorCultivoInterface::class,
        static fn (): \ZeaSys\Dominios\Terreno\Infraestructura\AltitudMysql =>
            new \ZeaSys\Dominios\Terreno\Infraestructura\AltitudMysql(getConnection())
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno::class,
        static fn (Container $c): \ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno =>
            new \ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno(
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\CacheInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\ProveedorSueloInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\AltitudPorCultivoInterface::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Terreno\Aplicacion\ServicioClimaActual::class,
        static fn (Container $c): \ZeaSys\Dominios\Terreno\Aplicacion\ServicioClimaActual =>
            new \ZeaSys\Dominios\Terreno\Aplicacion\ServicioClimaActual(
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\CacheInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\ProveedorClimaActualInterface::class),
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

    // --- Simulaciones (F04): motor IA por puerto, repositorio y explicabilidad por estrategias ---
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface::class,
        static fn (): \ZeaSys\Dominios\Simulaciones\Infraestructura\SimulacionRepositoryMysql =>
            new \ZeaSys\Dominios\Simulaciones\Infraestructura\SimulacionRepositoryMysql(getConnection())
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Dominio\MotorPrediccionInterface::class,
        static fn (): \ZeaSys\Dominios\Simulaciones\Infraestructura\ClienteMotorFlask =>
            new \ZeaSys\Dominios\Simulaciones\Infraestructura\ClienteMotorFlask()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Dominio\GestorMotorIaInterface::class,
        static fn (): \ZeaSys\Dominios\Simulaciones\Infraestructura\GestorMotorIa =>
            new \ZeaSys\Dominios\Simulaciones\Infraestructura\GestorMotorIa()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EvaluadorCondiciones::class,
        static fn (): \ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EvaluadorCondiciones =>
            new \ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EvaluadorCondiciones()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\RegistroExplicadores::class,
        static fn (): \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\RegistroExplicadores =>
            new \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\RegistroExplicadores()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion::class,
        static fn (Container $c): \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion =>
            new \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion(
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad::class,
        static fn (Container $c): \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad =>
            new \ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad(
                $c->get(\ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EvaluadorCondiciones::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\RegistroExplicadores::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Aplicacion\SimulacionService::class,
        static fn (Container $c): \ZeaSys\Dominios\Simulaciones\Aplicacion\SimulacionService =>
            new \ZeaSys\Dominios\Simulaciones\Aplicacion\SimulacionService(
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\MotorPrediccionInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\GestorMotorIaInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad::class),
                $c->get(\ZeaSys\Dominios\Terreno\Dominio\CacheInterface::class),
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Simulaciones\Http\SimulacionController::class,
        static fn (Container $c): \ZeaSys\Dominios\Simulaciones\Http\SimulacionController =>
            new \ZeaSys\Dominios\Simulaciones\Http\SimulacionController(
                $c->get(\ZeaSys\Dominios\Simulaciones\Aplicacion\SimulacionService::class)
            )
    );

    // --- Analítica DSS (F05): catálogo compartido + 4 dashboards ---
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface::class,
        static fn (): \ZeaSys\Dominios\Analitica\Infraestructura\RepositorioCatalogoAgronomico =>
            new \ZeaSys\Dominios\Analitica\Infraestructura\RepositorioCatalogoAgronomico()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Aplicacion\ServicioPrecioMaiz::class,
        static fn (): \ZeaSys\Dominios\Analitica\Aplicacion\ServicioPrecioMaiz =>
            new \ZeaSys\Dominios\Analitica\Aplicacion\ServicioPrecioMaiz()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield =>
            new \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield(
                $c->get(\ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface::class),
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaScenario::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaScenario =>
            new \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaScenario(
                $c->get(\ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface::class),
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaFinancial::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaFinancial =>
            new \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaFinancial(
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Http\YieldController::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Http\YieldController =>
            new \ZeaSys\Dominios\Analitica\Http\YieldController(
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield::class)
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Http\ScenarioController::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Http\ScenarioController =>
            new \ZeaSys\Dominios\Analitica\Http\ScenarioController(
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaScenario::class)
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Http\FinancialController::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Http\FinancialController =>
            new \ZeaSys\Dominios\Analitica\Http\FinancialController(
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaFinancial::class)
            )
    );

    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate =>
            new \ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate(
                $c->get(\ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface::class),
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno::class),
                $c->get(\ZeaSys\Dominios\Terreno\Aplicacion\ServicioClimaActual::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Analitica\Http\ClimateController::class,
        static fn (Container $c): \ZeaSys\Dominios\Analitica\Http\ClimateController =>
            new \ZeaSys\Dominios\Analitica\Http\ClimateController(
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate::class)
            )
    );

    // --- Chat: contexto autorizado → flujo único de Flowise (Gemini) ---
    $contenedor->registrar(
        \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise::class,
        static fn (): \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise =>
            new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface::class,
        static fn (): \ZeaSys\Dominios\Chat\Infraestructura\MemoriaSesion =>
            new \ZeaSys\Dominios\Chat\Infraestructura\MemoriaSesion()
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Chat\Dominio\FavoritoRepositoryInterface::class,
        static fn (): \ZeaSys\Dominios\Chat\Infraestructura\FavoritoRepositoryMysql =>
            new \ZeaSys\Dominios\Chat\Infraestructura\FavoritoRepositoryMysql(getConnection())
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Chat\Aplicacion\FavoritoService::class,
        static fn (Container $c): \ZeaSys\Dominios\Chat\Aplicacion\FavoritoService =>
            new \ZeaSys\Dominios\Chat\Aplicacion\FavoritoService(
                $c->get(\ZeaSys\Dominios\Chat\Dominio\FavoritoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Chat\Aplicacion\ContextoAgricolaService::class,
        static fn (Container $c): \ZeaSys\Dominios\Chat\Aplicacion\ContextoAgricolaService =>
            new \ZeaSys\Dominios\Chat\Aplicacion\ContextoAgricolaService(
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate::class),
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield::class),
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaFinancial::class),
                $c->get(\ZeaSys\Dominios\Analitica\Aplicacion\ServicioPrecioMaiz::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Chat\Aplicacion\ChatService::class,
        static fn (Container $c): \ZeaSys\Dominios\Chat\Aplicacion\ChatService =>
            new \ZeaSys\Dominios\Chat\Aplicacion\ChatService(
                $c->get(\ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface::class),
                $c->get(\ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface::class),
                $c->get(\ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise::class),
                $c->get(\ZeaSys\Dominios\Chat\Aplicacion\ContextoAgricolaService::class),
                $c->get(\ZeaSys\Dominios\Chat\Aplicacion\FavoritoService::class),
            )
    );
    $contenedor->registrar(
        \ZeaSys\Dominios\Chat\Http\ChatController::class,
        static fn (Container $c): \ZeaSys\Dominios\Chat\Http\ChatController =>
            new \ZeaSys\Dominios\Chat\Http\ChatController(
                $c->get(\ZeaSys\Dominios\Chat\Aplicacion\ChatService::class)
            )
    );

    $legacy = [];
    foreach ($legacy as $clase) {
        $contenedor->registrar($clase, static fn (): object => new $clase());
    }

    return $contenedor;
};
