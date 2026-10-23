<?php
// src/Dominios/Terreno/Dominio/CacheInterface.php — Contrato de la caché de datos de terreno.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface CacheInterface
{
    /**
     * @param int $ttlSegundos Vigencia de la entrada. El clima actual usa 30 min;
     *                        los datos de suelo/clima histórico conservan 24 h.
     * @return array<string, mixed>|null  null = no existe o expiró
     */
    public function obtener(string $clave, int $ttlSegundos = 86400): ?array;

    /** @param array<string, mixed> $valor */
    public function guardar(string $clave, array $valor): void;

    /** Elimina las cachés de terreno con más de 24 h. */
    public function limpiarExpirados(): void;
}
