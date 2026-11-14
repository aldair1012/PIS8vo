<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorLluviaAnualInterface
{
    public function obtener(float $lat, float $lon): ?array;
    public function obtenerParaParcela(array $parcela): ?array;
}
