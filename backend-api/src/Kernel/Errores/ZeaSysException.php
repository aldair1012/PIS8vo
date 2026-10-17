<?php
// src/Kernel/Errores/ZeaSysException.php — excepción base del kernel con código HTTP asociado.
declare(strict_types=1);

namespace ZeaSys\Kernel\Errores;

class ZeaSysException extends \Exception
{
    public function __construct(string $mensaje, private int $codigoHttp = 500, ?\Throwable $anterior = null)
    {
        parent::__construct($mensaje, 0, $anterior);
    }

    public function codigoHttp(): int
    {
        return $this->codigoHttp;
    }
}
