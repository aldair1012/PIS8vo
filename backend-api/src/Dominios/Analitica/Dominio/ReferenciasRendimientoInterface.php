<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Dominio;

interface ReferenciasRendimientoInterface
{
    /** Referencias públicas con fuente, unidad, periodo y supuestos explícitos. */
    public function obtener(array $cultivo): array;
}
