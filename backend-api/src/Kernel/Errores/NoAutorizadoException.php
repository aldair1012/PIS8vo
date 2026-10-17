<?php
// src/Kernel/Errores/NoAutorizadoException.php — 401: sesión requerida (no autorizado).
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class NoAutorizadoException extends ZeaSysException
{
    public function __construct(string $mensaje = 'No autorizado. Debe iniciar sesión.')
    {
        parent::__construct($mensaje, 401);
    }
}
