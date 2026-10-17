<?php
// src/Dominios/Lotes/Http/CultivoController.php — Controlador HTTP del dominio lotes (capa delgada).
declare(strict_types=1);

namespace ZeaSys\Dominios\Lotes\Http;

use ZeaSys\Dominios\Lotes\Aplicacion\CultivoService;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class CultivoController
{
    public function __construct(private CultivoService $servicio)
    {
    }

    public function listar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->listar($this->usuarioId())); }
    public function crear(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->crear($this->usuarioId(), $peticion)); }
    public function actualizar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->actualizar($this->usuarioId(), $peticion)); }
    public function eliminar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->eliminar($this->usuarioId(), $peticion)); }
    public function mapa(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->mapa()); }
    public function obtenerValoresUbicacion(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->obtenerValoresUbicacion($this->usuarioId(), $peticion)); }

    /**
     * El middleware de sesión ya garantiza $_SESSION['usuario_id'] para estas rutas.
     * Lectura directa de superglobal deliberada: Http es la capa sancionada para superglobals
     * (traducción Petición→servicio). GestorSesionInterface existe para las ESCRITURAS de sesión
     * de Autenticación (login/logout) a nivel Aplicación; aquí solo se lee el id ya fijado.
     */
    private function usuarioId(): int
    {
        return (int) $_SESSION['usuario_id'];
    }
}
