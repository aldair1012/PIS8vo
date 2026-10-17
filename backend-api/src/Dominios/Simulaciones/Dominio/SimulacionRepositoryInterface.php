<?php
// src/Dominios/Simulaciones/Dominio/SimulacionRepositoryInterface.php — Contrato del repositorio de simulaciones (sin predecir(): vive en MotorPrediccionInterface).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface SimulacionRepositoryInterface
{
    /** @param array<string, mixed> $datos @param array<string, mixed> $resultado @return int id insertado */
    public function guardar(array $datos, array $resultado): int;

    /** @return array<int, array<string, mixed>> */
    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null): array;

    /** @return array<string, mixed>|null */
    public function obtenerPorId(int $id): ?array;

    /** @return array<string, mixed> */
    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array;

    /** @return array<int, array<string, mixed>> */
    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array;

    public function eliminar(int $id): bool;

    public function contarPorUsuario(int $usuarioId): int;

    /**
     * Última simulación de una parcela (con fallback sin año): SQL inline de
     * SimulacionController::explain() líneas 249–265 (port en T13 del catálogo de explicadores).
     *
     * @return array<string, mixed>|null
     */
    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $anio = null): ?array;
}
