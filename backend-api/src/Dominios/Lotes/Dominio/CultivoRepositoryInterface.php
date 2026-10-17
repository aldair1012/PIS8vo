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

    public function contarPorUsuario(int $usuarioId): int;

    public function areaTotalPorUsuario(int $usuarioId): float;
}
