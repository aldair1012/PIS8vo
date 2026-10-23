<?php
// src/Dominios/Chat/Dominio/FavoritoRepositoryInterface.php — Puerto de conversaciones favoritas.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Dominio;

interface FavoritoRepositoryInterface
{
    /**
     * Inserta o actualiza la conversación guardada por el usuario.
     * La clave lógica es (usuario_id, conversacion_id).
     *
     * @param array<string, mixed> $datos
     * @return int id del registro persistido
     */
    public function guardar(int $usuarioId, string $conversacionId, array $datos): int;

    /**
     * Conversaciones guardadas más recientes que aplican a la parcela y el año
     * indicados. También devuelve las guardadas sin parcela o sin año.
     *
     * @return array<int, array<string, mixed>>
     */
    public function obtenerRecientes(int $usuarioId, ?int $cultivoId, ?int $anio, int $limite = 4): array;

    public function eliminar(int $usuarioId, string $conversacionId): void;
}
