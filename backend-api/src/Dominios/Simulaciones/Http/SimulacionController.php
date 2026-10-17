<?php
// src/Dominios/Simulaciones/Http/SimulacionController.php — Controlador HTTP del dominio simulaciones (capa delgada).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Http;

use ZeaSys\Dominios\Simulaciones\Aplicacion\SimulacionService;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class SimulacionController
{
    public function __construct(private SimulacionService $servicio)
    {
    }

    public function simular(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->simular($this->usuarioId(), $peticion)); }
    public function historial(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->historial($this->usuarioId(), $peticion)); }
    public function eliminar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->eliminar($this->usuarioId(), $peticion)); }
    public function iaStatus(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->iaStatus($peticion)); }
    public function explain(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->explain($this->usuarioId(), $peticion)); }

    /**
     * El middleware de sesión ya garantiza $_SESSION['usuario_id'] para estas rutas
     * (iaStatus es pública pero no usa este helper). Lectura directa de superglobal
     * deliberada: Http es la capa sancionada para superglobals (traducción Petición→servicio).
     * Aquí solo se lee el id ya fijado por el login.
     */
    private function usuarioId(): int
    {
        return (int) $_SESSION['usuario_id'];
    }
}
