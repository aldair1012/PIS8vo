<?php
/**
 * Repositorio: FavoritoRepositoryMysql
 * ===================================
 * Persiste las conversaciones que el productor marca como favoritas. El
 * chatbot las recuerda más adelante sólo cuando la pregunta las menciona.
 */

declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Dominios\Chat\Dominio\FavoritoRepositoryInterface;

final class FavoritoRepositoryMysql implements FavoritoRepositoryInterface
{
    public function __construct(private \PDO $db)
    {
    }

    public function guardar(int $usuarioId, string $conversacionId, array $datos): int
    {
        $mensajes = json_encode(
            $datos['mensajes'] ?? [],
            JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );
        $contexto = json_encode(
            $datos['contexto'] ?? [],
            JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );

        $stmt = $this->db->prepare(
            'INSERT INTO conversaciones_favoritas
                (usuario_id, parcela_id, año, ambito, vista, conversacion_id, titulo, mensajes_json, contexto_json)
             VALUES
                (:usuario_id, :parcela_id, :año, :ambito, :vista, :conversacion_id, :titulo, :mensajes_json, :contexto_json)
             ON DUPLICATE KEY UPDATE
                parcela_id = VALUES(parcela_id),
                año = VALUES(año),
                ambito = VALUES(ambito),
                vista = VALUES(vista),
                titulo = VALUES(titulo),
                mensajes_json = VALUES(mensajes_json),
                contexto_json = VALUES(contexto_json),
                actualizado_en = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            ':usuario_id' => $usuarioId,
            ':parcela_id' => $datos['parcela_id'] ?? null,
            ':año' => $datos['año'] ?? null,
            ':ambito' => (string) ($datos['ambito'] ?? 'dashboard'),
            ':vista' => $datos['vista'] ?? null,
            ':conversacion_id' => $conversacionId,
            ':titulo' => mb_substr((string) ($datos['titulo'] ?? 'Conversación guardada'), 0, 180, 'UTF-8'),
            ':mensajes_json' => is_string($mensajes) ? $mensajes : '[]',
            ':contexto_json' => is_string($contexto) ? $contexto : null,
        ]);

        $id = (int) $this->db->lastInsertId();
        if ($id > 0) {
            return $id;
        }

        // En un UPDATE por clave duplicada lastInsertId() es 0; se recupera el id.
        $stmt = $this->db->prepare(
            'SELECT id FROM conversaciones_favoritas
             WHERE usuario_id = :usuario_id AND conversacion_id = :conversacion_id
             LIMIT 1'
        );
        $stmt->execute([
            ':usuario_id' => $usuarioId,
            ':conversacion_id' => $conversacionId,
        ]);

        return (int) ($stmt->fetchColumn() ?: 0);
    }

    public function obtenerRecientes(int $usuarioId, ?int $cultivoId, ?int $año, int $limite = 4): array
    {
        $limite = max(1, min(10, $limite));
        $condiciones = ['usuario_id = :usuario_id'];
        $parametros = [':usuario_id' => $usuarioId];

        if ($cultivoId !== null) {
            $condiciones[] = '(parcela_id = :parcela_id OR parcela_id IS NULL)';
            $parametros[':parcela_id'] = $cultivoId;
        }
        if ($año !== null) {
            $condiciones[] = '(año = :año OR año IS NULL)';
            $parametros[':año'] = $año;
        }

        $stmt = $this->db->prepare(
            'SELECT id, parcela_id, año, ambito, vista, conversacion_id, titulo, mensajes_json, actualizado_en
             FROM conversaciones_favoritas
             WHERE ' . implode(' AND ', $condiciones) . '
             ORDER BY actualizado_en DESC, id DESC
             LIMIT ' . $limite
        );
        $stmt->execute($parametros);

        return $stmt->fetchAll() ?: [];
    }

    public function eliminar(int $usuarioId, string $conversacionId): void
    {
        $stmt = $this->db->prepare(
            'DELETE FROM conversaciones_favoritas
             WHERE usuario_id = :usuario_id AND conversacion_id = :conversacion_id'
        );
        $stmt->execute([
            ':usuario_id' => $usuarioId,
            ':conversacion_id' => $conversacionId,
        ]);
    }
}
