<?php
// src/Dominios/Simulaciones/Dominio/SimulacionRepositoryInterface.php — Contrato del repositorio de simulaciones (sin predecir(): vive en MotorPrediccionInterface).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface SimulacionRepositoryInterface
{
    /** @param array<string, mixed> $datos @param array<string, mixed> $resultado @return int id insertado */
    public function guardar(array $datos, array $resultado): int;

    /** @return array<int, array<string, mixed>> */
    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null, int $desplazamiento = 0): array;

    /** @return list<int> Años de todo el historial del usuario, independientes de la página. */
    public function obtenerAniosPorUsuario(int $usuarioId): array;

    /** @return array<string, mixed>|null */
    public function obtenerPorId(int $id): ?array;

    /** @return array<string, mixed> */
    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array;

    /** @return array<int, array<string, mixed>> @used-by F05 (Scenario/Financial migrarán a este repositorio). */
    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array;

    /** @return array<int, array<string, mixed>> Simulaciones de una sola parcela; year es el año de creación. */
    public function obtenerRecientesPorCultivo(int $usuarioId, int $cultivoId, int $limite = 50, ?int $year = null): array;

    public function eliminar(int $id): bool;

    /** @used-by F05 (Scenario migrará a este repositorio). */
    public function contarPorUsuario(int $usuarioId): int;

    /**
     * Última simulación de una parcela, limitada al año solicitado si no es null.
     * Devuelve null si no hay registros; nunca recurre a una campaña distinta.
     *
     * @return array<string, mixed>|null
     */
    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $año = null): ?array;
}
