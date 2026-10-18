<?php
// src/Dominios/Analitica/Http/ScenarioController.php — Controlador delgado para el dashboard Scenario.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Http;

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaScenario;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class ScenarioController
{
    public function __construct(private ServicioAnaliticaScenario $servicio) {}

    public function index(Peticion $peticion): void
    {
        RespuestaJson::enviar($this->servicio->construir(
            $this->usuarioId(),
            $peticion->queryEntero('cultivo_id', null, 1),
            $peticion->queryEntero('anio', null, 2000, 2100),
        ));
    }

    /** El middleware de sesión ya garantiza $_SESSION['usuario_id'] para estas rutas. */
    private function usuarioId(): int
    {
        return (int) $_SESSION['usuario_id'];
    }
}
