<?php
// src/Dominios/Terreno/Dominio/ProveedorClimaInterface.php — Contrato del proveedor de datos de clima.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorClimaInterface
{
    /**
     * @return array<string, mixed>  bloque 'clima' tal como lo arma el método original
     *                               (solo las claves que el proveedor pudo calcular)
     */
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array;

    /**
     * @return array<string, mixed>|null  resumen mensual de los últimos 12 meses
     *                                     (totales de lluvia y medias de temperatura),
     *                                     o null si no se pudo calcular.
     */
    public function obtenerResumenMensual12Meses(float $latitud, float $longitud): ?array;
}
