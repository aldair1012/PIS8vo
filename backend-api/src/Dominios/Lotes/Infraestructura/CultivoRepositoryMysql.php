<?php
/**
 * Repositorio: CultivoRepositoryMysql
 * ====================================
 * Port de models/Cultivo.php con los cambios mecánicos del plan F03 (Task 10 Step 3):
 * namespace, final + interface, PDO inyectada en el constructor y sin require_once de config.
 * Todo lo demás (métodos, SQL, mensajes) verbatim.
 */

declare(strict_types=1);

namespace ZeaSys\Dominios\Lotes\Infraestructura;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;

final class CultivoRepositoryMysql implements CultivoRepositoryInterface
{
    public function __construct(private \PDO $db)
    {
    }

    public function crear(array $datos): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO cultivos
                (usuario_id, nombre_parcela, variedad_maiz, tipo_maiz, ubicacion, area, latitud, longitud, fecha_siembra, geojson, altitud, ph, fertilizacion_fecha, fertilizacion_dosis, fertilizacion_tipo)
             VALUES
                (:usuario_id, :nombre_parcela, :variedad_maiz, :tipo_maiz, :ubicacion, :area, :latitud, :longitud, :fecha_siembra, :geojson, :altitud, :ph, :fertilizacion_fecha, :fertilizacion_dosis, :fertilizacion_tipo)'
        );
        $stmt->execute([
            'usuario_id'     => $datos['usuario_id'],
            'nombre_parcela' => $datos['nombre_parcela'],
            'variedad_maiz'  => $datos['variedad_maiz'] ?? 'Híbrido convencional',
            'tipo_maiz'      => $datos['tipo_maiz'] ?? 'Duro Amarillo',
            'ubicacion'      => $datos['ubicacion'] ?? null,
            'area'           => $datos['area'],
            'latitud'        => $datos['latitud'] ?? null,
            'longitud'       => $datos['longitud'] ?? null,
            'fecha_siembra'  => $datos['fecha_siembra'] ?? null,
            'geojson'        => $datos['geojson'] ?? null,
            'altitud'        => $datos['altitud'] ?? null,
            'ph'             => $datos['ph'] ?? null,
            'fertilizacion_fecha' => $datos['fertilizacion_fecha'] ?? null,
            'fertilizacion_dosis' => $datos['fertilizacion_dosis'] ?? null,
            'fertilizacion_tipo'  => $datos['fertilizacion_tipo'] ?? null
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function obtenerPorUsuario(int $usuarioId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM cultivos
             WHERE usuario_id = :usuario_id AND activo = 1
             ORDER BY fecha_registro DESC'
        );
        $stmt->execute(['usuario_id' => $usuarioId]);
        return $stmt->fetchAll();
    }

    public function obtenerPorId(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM cultivos WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function obtenerConCoordenadas(int $usuarioId): array
    {
        $stmt = $this->db->prepare(
            'SELECT c.*, u.nombre as nombre_usuario
             FROM cultivos c
             JOIN usuarios u ON c.usuario_id = u.id
             WHERE c.usuario_id = :usuario_id
               AND c.latitud IS NOT NULL
               AND c.longitud IS NOT NULL
               AND c.activo = 1
             ORDER BY c.fecha_registro DESC'
        );
        $stmt->execute(['usuario_id' => $usuarioId]);
        return $stmt->fetchAll();
    }

    public function actualizar(int $id, array $datos): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE cultivos SET
                nombre_parcela = :nombre_parcela,
                variedad_maiz  = :variedad_maiz,
                tipo_maiz      = :tipo_maiz,
                ubicacion      = :ubicacion,
                area           = :area,
                latitud        = :latitud,
                longitud       = :longitud,
                fecha_siembra  = :fecha_siembra,
                geojson        = :geojson,
                altitud        = :altitud,
                ph             = :ph,
                fertilizacion_fecha = :fertilizacion_fecha,
                fertilizacion_dosis = :fertilizacion_dosis,
                fertilizacion_tipo  = :fertilizacion_tipo
             WHERE id = :id'
        );
        return $stmt->execute([
            'nombre_parcela' => $datos['nombre_parcela'],
            'variedad_maiz'  => $datos['variedad_maiz'],
            'tipo_maiz'      => $datos['tipo_maiz'],
            'ubicacion'      => $datos['ubicacion'] ?? null,
            'area'           => $datos['area'],
            'latitud'        => $datos['latitud'] ?? null,
            'longitud'       => $datos['longitud'] ?? null,
            'fecha_siembra'  => $datos['fecha_siembra'] ?? null,
            'geojson'        => $datos['geojson'] ?? null,
            'altitud'        => $datos['altitud'] ?? null,
            'ph'             => $datos['ph'] ?? null,
            'fertilizacion_fecha' => $datos['fertilizacion_fecha'] ?? null,
            'fertilizacion_dosis' => $datos['fertilizacion_dosis'] ?? null,
            'fertilizacion_tipo'  => $datos['fertilizacion_tipo'] ?? null,
            'id'             => $id
        ]);
    }

    public function eliminar(int $id): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE cultivos SET activo = 0 WHERE id = :id'
        );
        return $stmt->execute(['id' => $id]);
    }

    public function contarPorUsuario(int $usuarioId): int
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM cultivos
             WHERE usuario_id = :usuario_id AND activo = true'
        );
        $stmt->execute(['usuario_id' => $usuarioId]);
        return (int) $stmt->fetchColumn();
    }

    public function areaTotalPorUsuario(int $usuarioId): float
    {
        $stmt = $this->db->prepare(
            'SELECT COALESCE(SUM(area), 0) FROM cultivos
             WHERE usuario_id = :usuario_id AND activo = true'
        );
        $stmt->execute(['usuario_id' => $usuarioId]);
        return (float) $stmt->fetchColumn();
    }
}
