<?php
// src/Kernel/Errores/ValidacionException.php — 400: entrada inválida (validación).
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class ValidacionException extends ZeaSysException
{
    public function __construct(string $mensaje)
    {
        parent::__construct($mensaje, 400);
    }
}
