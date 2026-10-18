<?php
// src/Dominios/Analitica/Http/YieldController.php — Controlador delgado para el dashboard Yield.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Http;

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class YieldController
{
    public function __construct(private ServicioAnaliticaYield $servicio) {}

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
