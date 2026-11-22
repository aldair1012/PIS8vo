<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Infraestructura;

use PDO;
use PDOException;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class CampanasRepository
{
    public function __construct(private PDO $db) {}

    public function comprobarParcela(int $usuario, int $parcela): void
    {
        $s = $this->db->prepare('SELECT id FROM parcelas WHERE id = ? AND usuario_id = ? AND activo = 1');
        $s->execute([$parcela, $usuario]);
        if (!$s->fetchColumn()) throw new AccesoDenegadoException('La parcela no está disponible.');
    }

    public function simulacion(int $usuario, int $parcela, int $id): array
    {
        $s = $this->db->prepare('SELECT id, fecha, rendimiento_estimado, area_simulada, escenarios_json
            FROM simulaciones WHERE usuario_id = ? AND parcela_id = ? AND id = ?');
        $s->execute([$usuario, $parcela, $id]);
        return $s->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    public function cosechas(int $parcela): array
    {
        $s = $this->db->prepare('SELECT fecha_siembra, fecha_cosecha, produccion_seca_kg, area_cosechada_ha,
            humedad_grano_pct, fuente, prediccion_json, base_comparable, registrado_en
            FROM cosechas_campana WHERE parcela_id = ? ORDER BY fecha_siembra DESC');
        $s->execute([$parcela]);
        return $s->fetchAll(PDO::FETCH_ASSOC);
    }

    public function observaciones(int $parcela): array
    {
        $s = $this->db->prepare('SELECT id, fecha_siembra, fecha, fuente, ndvi, nota, adjunto_tipo, registrado_en
            FROM observaciones_campana WHERE parcela_id = ? ORDER BY fecha_siembra DESC, fecha DESC, id DESC');
        $s->execute([$parcela]);
        return $s->fetchAll(PDO::FETCH_ASSOC);
    }

    public function adjunto(int $usuario, int $id): array
    {
        $s = $this->db->prepare('SELECT o.adjunto_tipo, o.adjunto FROM observaciones_campana o
            JOIN parcelas p ON p.id = o.parcela_id WHERE p.usuario_id = ? AND p.activo = 1 AND o.id = ?
            AND o.adjunto_tipo IS NOT NULL');
        $s->execute([$usuario, $id]);
        return $s->fetch(PDO::FETCH_ASSOC) ?: throw new AccesoDenegadoException('El adjunto no está disponible.');
    }

    public function insertarCosecha(array $fila): void
    {
        $sql = 'INSERT INTO cosechas_campana (parcela_id, fecha_siembra, fecha_cosecha, produccion_seca_kg,
            area_cosechada_ha, humedad_grano_pct, fuente, prediccion_json, base_comparable)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        $this->insertar($sql, $fila, 'Esta parcela ya tiene una cosecha para esa campaña o fecha.');
    }

    public function insertarObservacion(array $fila): void
    {
        $sql = 'INSERT INTO observaciones_campana
            (parcela_id, fecha_siembra, fecha, fuente, ndvi, nota, huella, adjunto_tipo, adjunto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        $this->insertar($sql, $fila, 'Esta observación ya fue guardada.');
    }

    private function insertar(string $sql, array $fila, string $duplicado): void
    {
        try {
            $this->db->prepare($sql)->execute($fila);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? null) === 1062) throw new ValidacionException($duplicado);
            throw $e;
        }
    }
}
