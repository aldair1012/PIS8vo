<?php
// src/Dominios/Terreno/Dominio/ProveedorClimaActualInterface.php — Contrato para clima observado y pronóstico.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorClimaActualInterface
{
    /**
     * Devuelve el clima actual y el pronóstico diario de la parcela.
     *
     * @return array<string, mixed>
     */
    public function obtenerClimaActual(float $latitud, float $longitud, ?float $altitud = null): array;
}
