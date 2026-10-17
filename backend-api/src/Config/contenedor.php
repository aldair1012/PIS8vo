<?php
// src/Config/contenedor.php — Bindings del contenedor DI.
// F01: controladores legacy. F02–F05 añaden los bindings de cada dominio nuevo.

use ZeaSys\Kernel\Container;

return static function (): Container {
    $contenedor = new Container();

    $legacy = [
        'AuthController',
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
