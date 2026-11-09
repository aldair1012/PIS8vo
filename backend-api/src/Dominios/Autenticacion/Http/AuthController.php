<?php
// src/Dominios/Autenticacion/Http/AuthController.php — Controlador HTTP del dominio autenticación (capa delgada).
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Http;

use ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class AuthController
{
    public function __construct(private AutenticacionService $servicio)
    {
    }

    public function yo(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->yo()); }
    public function iniciarSesion(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->iniciarSesion($peticion)); }
    public function iniciarSesionGoogle(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->iniciarSesionGoogle($peticion)); }
    public function registrarse(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->registrarse($peticion)); }
    public function cerrarSesion(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->cerrarSesion()); }
    public function actualizar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->actualizar($peticion)); }
    public function subirAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->subirAvatar($_FILES['foto'] ?? [])); }
    public function eliminarAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->eliminarAvatar()); }
    public function sincronizarAvatarGoogle(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->sincronizarAvatarGoogle($peticion)); }
    public function eliminarCuenta(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->eliminarCuenta()); }
}
