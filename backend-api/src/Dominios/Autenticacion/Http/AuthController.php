<?php
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

    public function me(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->me()); }
    public function login(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->login($peticion)); }
    public function googleLogin(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->googleLogin($peticion)); }
    public function registro(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->registro($peticion)); }
    public function logout(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->logout()); }
    public function update(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->update($peticion)); }
    public function uploadAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->uploadAvatar()); }
    public function deleteAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->deleteAvatar()); }
    public function syncGoogleAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->syncGoogleAvatar($peticion)); }
    public function eliminar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->eliminar()); }
}
