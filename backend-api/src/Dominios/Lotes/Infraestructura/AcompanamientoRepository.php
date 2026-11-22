<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Lotes\Infraestructura;

use PDO;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class AcompanamientoRepository
{
    public function __construct(private PDO $db) {}

    public function otorgados(int $titular): array
    {
        $q = $this->db->prepare('SELECT p.id parcela_id, p.nombre_parcela, a.tecnico_id, t.correo, a.creado_en
            FROM accesos_tecnicos a JOIN parcelas p ON p.id = a.parcela_id JOIN usuarios t ON t.id = a.tecnico_id
            WHERE p.usuario_id = ? AND p.activo = 1 ORDER BY p.nombre_parcela, t.correo');
        $q->execute([$titular]);
        return $q->fetchAll(PDO::FETCH_ASSOC);
    }

    public function autorizar(int $titular, int $parcela, string $correo): void
    {
        $this->verificarTitular($titular, $parcela);
        $q = $this->db->prepare('SELECT id FROM usuarios WHERE correo = ? AND activo = 1 AND id <> ?');
        $q->execute([$correo, $titular]);
        $tecnico = $q->fetchColumn();
        if (!$tecnico) throw new ValidacionException('Indica el correo de otra cuenta activa de ZeaSys.');
        $q = $this->db->prepare('INSERT INTO accesos_tecnicos (parcela_id, tecnico_id)
            SELECT id, ? FROM parcelas WHERE id = ? AND usuario_id = ? AND activo = 1
            ON DUPLICATE KEY UPDATE tecnico_id = VALUES(tecnico_id)');
        $q->execute([$tecnico, $parcela, $titular]);
    }

    public function revocar(int $titular, int $parcela, int $tecnico): void
    {
        $this->verificarTitular($titular, $parcela);
        $q = $this->db->prepare('DELETE a FROM accesos_tecnicos a INNER JOIN parcelas p ON p.id = a.parcela_id
            WHERE p.usuario_id = ? AND p.id = ? AND a.tecnico_id = ?');
        $q->execute([$titular, $parcela, $tecnico]);
    }

    private function verificarTitular(int $titular, int $parcela): void
    {
        $q = $this->db->prepare('SELECT id FROM parcelas WHERE id = ? AND usuario_id = ? AND activo = 1');
        $q->execute([$parcela, $titular]);
        if (!$q->fetchColumn()) throw new AccesoDenegadoException('Sólo el titular puede administrar el acceso a la parcela.');
    }

    public function compartidas(int $tecnico): array
    {
        $q = $this->db->prepare('SELECT p.id, p.nombre_parcela, p.fecha_siembra, p.area, c.fecha_cosecha,
            c.produccion_seca_kg, c.area_cosechada_ha, m.datos_json,
            (SELECT MAX(o.fecha) FROM observaciones_campana o WHERE o.parcela_id = p.id AND o.fecha_siembra = p.fecha_siembra) ultima_observacion
            FROM accesos_tecnicos a JOIN parcelas p ON p.id = a.parcela_id
            JOIN usuarios u ON u.id = p.usuario_id AND u.activo = 1
            LEFT JOIN cosechas_campana c ON c.parcela_id = p.id AND c.fecha_siembra = p.fecha_siembra
            LEFT JOIN mediciones_rendimiento m ON m.parcela_id = p.id
            WHERE a.tecnico_id = ? AND p.activo = 1 ORDER BY p.nombre_parcela, p.id');
        $q->execute([$tecnico]);
        return $q->fetchAll(PDO::FETCH_ASSOC);
    }
}
