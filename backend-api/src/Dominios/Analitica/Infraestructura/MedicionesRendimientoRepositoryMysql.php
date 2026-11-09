<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Infraestructura;
use ZeaSys\Dominios\Analitica\Dominio\MedicionesRendimientoRepositoryInterface;

final class MedicionesRendimientoRepositoryMysql implements MedicionesRendimientoRepositoryInterface
{
    public function __construct(private \PDO $db) {}
    public function obtener(int $usuarioId, int $cultivoId): array
    {
        $s = $this->db->prepare('SELECT m.datos_json, m.actualizado_en FROM mediciones_rendimiento m INNER JOIN parcelas c ON c.id = m.parcela_id WHERE c.id = :id AND c.usuario_id = :usuario AND c.activo = 1');
        $s->execute(['id' => $cultivoId, 'usuario' => $usuarioId]);
        $fila = $s->fetch(\PDO::FETCH_ASSOC);
        return $fila ? ['datos' => json_decode($fila['datos_json'], true) ?: [], 'actualizado_en' => $fila['actualizado_en']] : ['datos' => []];
    }
    public function guardar(int $usuarioId, int $cultivoId, array $datos): void
    {
        $s = $this->db->prepare('INSERT INTO mediciones_rendimiento (parcela_id, datos_json) SELECT id, :datos FROM parcelas WHERE id = :id AND usuario_id = :usuario AND activo = 1 ON DUPLICATE KEY UPDATE datos_json = VALUES(datos_json), actualizado_en = CURRENT_TIMESTAMP');
        $s->execute(['id' => $cultivoId, 'usuario' => $usuarioId, 'datos' => json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }
}
