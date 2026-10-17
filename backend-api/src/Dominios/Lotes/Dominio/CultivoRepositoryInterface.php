<?php
// src/Dominios/Lotes/Dominio/CultivoRepositoryInterface.php — Contrato del repositorio de cultivos (parcelas).
declare(strict_types=1);

namespace ZeaSys\Dominios\Lotes\Dominio;

interface CultivoRepositoryInterface
{
    /** @param array<string, mixed> $datos @return int id insertado */
    public function crear(array $datos): int;

    /** @return array<int, array<string, mixed>> */
    public function obtenerPorUsuario(int $usuarioId): array;

    /** @return array<string, mixed>|null */
    public function obtenerPorId(int $id): ?array;

    /** @return array<int, array<string, mixed>> */
    public function obtenerConCoordenadas(): array;

    /** @param array<string, mixed> $datos */
    public function actualizar(int $id, array $datos): bool;

    public function eliminar(int $id): bool;

    /** @used-by F04/F05: Climate (obtenerValoresUbicacion legacy) y Scenario (línea 39-40) migrarán a este repositorio. */
    public function contarPorUsuario(int $usuarioId): int;

    /** @used-by F04/F05: Scenario (línea 39-40) migrará a este repositorio. */
    public function areaTotalPorUsuario(int $usuarioId): float;
}
