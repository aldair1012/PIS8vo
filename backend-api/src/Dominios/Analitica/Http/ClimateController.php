<?php
// src/Dominios/Analitica/Http/ClimateController.php — Controlador delgado para el dashboard Climate.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Http;

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaClimate;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class ClimateController
{
    public function __construct(private ServicioAnaliticaClimate $servicio) {}

    public function index(Peticion $peticion): void
    {
        $cultivoId = $peticion->query('cultivo_id');
        $anio      = $peticion->query('anio');

        RespuestaJson::enviar($this->servicio->construir(
            $this->usuarioId(),
            ($cultivoId !== null && $cultivoId !== '') ? (int) $cultivoId : null,
            ($anio !== null && $anio !== '') ? (int) $anio : null,
        ));
    }

    /** El middleware de sesión ya garantiza $_SESSION['usuario_id'] para estas rutas. */
    private function usuarioId(): int
    {
        return (int) $_SESSION['usuario_id'];
    }
}