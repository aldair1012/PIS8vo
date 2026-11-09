<?php
declare(strict_types=1);
namespace ZeaSys\Kernel\Errores;
final class ConflictoException extends ZeaSysException
{
    public function __construct(string $mensaje) { parent::__construct($mensaje,409); }
}
