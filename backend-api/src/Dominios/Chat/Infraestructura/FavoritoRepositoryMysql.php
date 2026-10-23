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
            'INSERT INTO chat_favoritos
                (usuario_id, cultivo_id, anio, ambito, vista, conversacion_id, titulo, mensajes_json, contexto_json)
             VALUES
                (:usuario_id, :cultivo_id, :anio, :ambito, :vista, :conversacion_id, :titulo, :mensajes_json, :contexto_json)
             ON DUPLICATE KEY UPDATE
                cultivo_id = VALUES(cultivo_id),
                anio = VALUES(anio),
                ambito = VALUES(ambito),
                vista = VALUES(vista),
                titulo = VALUES(titulo),
                mensajes_json = VALUES(mensajes_json),
                contexto_json = VALUES(contexto_json),
                actualizado_en = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            ':usuario_id' => $usuarioId,
            ':cultivo_id' => $datos['cultivo_id'] ?? null,
            ':anio' => $datos['anio'] ?? null,
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
            'SELECT id FROM chat_favoritos
             WHERE usuario_id = :usuario_id AND conversacion_id = :conversacion_id
             LIMIT 1'
        );
        $stmt->execute([
            ':usuario_id' => $usuarioId,
            ':conversacion_id' => $conversacionId,
        ]);

        return (int) ($stmt->fetchColumn() ?: 0);
    }

    public function obtenerRecientes(int $usuarioId, ?int $cultivoId, ?int $anio, int $limite = 4): array
    {
        $limite = max(1, min(10, $limite));
        $condiciones = ['usuario_id = :usuario_id'];
        $parametros = [':usuario_id' => $usuarioId];

        if ($cultivoId !== null) {
            $condiciones[] = '(cultivo_id = :cultivo_id OR cultivo_id IS NULL)';
            $parametros[':cultivo_id'] = $cultivoId;
        }
        if ($anio !== null) {
            $condiciones[] = '(anio = :anio OR anio IS NULL)';
            $parametros[':anio'] = $anio;
        }

        $stmt = $this->db->prepare(
            'SELECT id, cultivo_id, anio, ambito, vista, conversacion_id, titulo, mensajes_json, actualizado_en
             FROM chat_favoritos
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
            'DELETE FROM chat_favoritos
             WHERE usuario_id = :usuario_id AND conversacion_id = :conversacion_id'
        );
        $stmt->execute([
            ':usuario_id' => $usuarioId,
            ':conversacion_id' => $conversacionId,
        ]);
    }
}
