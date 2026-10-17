<?php
// src/Dominios/Terreno/Dominio/CacheInterface.php — Contrato de la caché de datos de terreno.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface CacheInterface
{
    /** @return array<string, mixed>|null  null = no existe o expiró */
    public function obtener(string $clave): ?array;

    /** @param array<string, mixed> $valor */
    public function guardar(string $clave, array $valor): void;

    /** Elimina precision_data_*.json con más de 24 h (port de limpiarCacheExpirada()). */
    public function limpiarExpirados(): void;
}
