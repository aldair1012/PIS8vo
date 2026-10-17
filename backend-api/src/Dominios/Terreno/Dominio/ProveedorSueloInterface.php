<?php
// src/Dominios/Terreno/Dominio/ProveedorSueloInterface.php — Contrato del proveedor de datos de suelo.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorSueloInterface
{
    /**
     * @return array<string, mixed>  bloque 'suelo' tal como lo arma el método original
     *                               (solo las claves que el proveedor pudo calcular)
     */
    public function obtenerSuelo(float $latitud, float $longitud): array;
}
