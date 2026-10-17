<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface VerificadorTokenGoogleInterface
{
    /**
     * Valida el id_token contra Google.
     * @return array{nombre: string, correo: string, picture: string}
     * @throws \ZeaSys\Kernel\Errores\NoAutorizadoException token inválido/expirado o aud distinta
     * @throws \ZeaSys\Kernel\Errores\ValidacionException sin correo en el payload
     */
    public function verificar(string $idToken): array;
}
