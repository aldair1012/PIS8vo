<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Kernel\Errores\ValidacionException;

final class ConsentimientoAsistente
{
    public const VERSION = '2026-11-20';

    public function __construct(private \PDO $db) {}

    public function estado(int $usuarioId): array
    {
        $consulta = $this->db->prepare('SELECT version_aviso, autorizado, registrado_en FROM consentimiento_asistente WHERE usuario_id = ? ORDER BY id DESC LIMIT 1');
        $consulta->execute([$usuarioId]);
        $registro = $consulta->fetch(\PDO::FETCH_ASSOC);
        return ['version' => self::VERSION, 'autorizado' => $registro && $registro['version_aviso'] === self::VERSION && (bool) $registro['autorizado'],
            'registrado_en' => $registro['registrado_en'] ?? null];
    }

    public function decidir(int $usuarioId, mixed $autorizado, mixed $version): array
    {
        if (!is_bool($autorizado) || ($autorizado && $version !== self::VERSION)) {
            throw new ValidacionException('Revisa el aviso de privacidad vigente antes de autorizar.');
        }
        $insertar = $this->db->prepare('INSERT INTO consentimiento_asistente (usuario_id, version_aviso, autorizado) VALUES (?, ?, ?)');
        $insertar->execute([$usuarioId, self::VERSION, (int) $autorizado]);
        return $this->estado($usuarioId);
    }
}
