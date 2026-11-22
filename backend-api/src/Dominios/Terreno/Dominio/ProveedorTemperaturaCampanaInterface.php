<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorTemperaturaCampanaInterface
{
    public function gradosDia(float $lat, float $lon, string $inicio, string $fin): ?array;
}
