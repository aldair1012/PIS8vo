<?php
/**
 * Repositorio: SimulacionRepositoryMysql
 * ======================================
 * Repositorio MySQL de simulaciones. La predicción vive en ClienteMotorFlask
 * (puerto MotorPrediccionInterface), por lo que esta clase sólo persiste y
 * consulta resultados.
 */

declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Infraestructura;

use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;

final class SimulacionRepositoryMysql implements SimulacionRepositoryInterface
{
    public function __construct(private \PDO $db)
    {
    }

    public function guardar(array $datos, array $resultado): int
    {
        // Conservamos la salida probabilística del clasificador junto a los
        // escenarios sin cambiar el esquema existente de MySQL. Así, el
        // dashboard puede usar la probabilidad real incluso después de
        // cerrar la simulación.
        $escenarios = $resultado['escenarios'] ?? null;
        if (!is_array($escenarios)) {
            $escenarios = [];
        }
        if (array_key_exists('plan_fertilizacion', $datos) && is_array($datos['plan_fertilizacion'])) {
            $escenarios['plan_fertilizacion'] = $datos['plan_fertilizacion'];
        }
        $kpisModelo = [
            'explicacion_modelo' => $resultado['explicacion_modelo'] ?? null,
            'entradas_modelo' => $resultado['entradas_modelo'] ?? [],
            'trazabilidad' => $resultado['trazabilidad'] ?? [],
            'evaluacion_variedades' => $resultado['evaluacion_variedades'] ?? null,
            'parcela_ejecucion' => array_intersect_key($datos, array_flip(['variedad_maiz', 'tipo_maiz', 'ubicacion', 'latitud', 'longitud', 'altitud', 'fecha_siembra', 'parametros_campo', 'provincia_identificada', 'fuente_provincia'])),
            'modelo' => $resultado['modelo'] ?? null,
            'version_modelo' => $resultado['version_modelo'] ?? null,
            'metricas_modelo' => $resultado['metricas_modelo'] ?? [],
            'probabilidad_cosecha' => $resultado['probabilidad_cosecha'] ?? null,
            'probabilidades_cosecha' => $resultado['probabilidades_cosecha'] ?? [],
            'intervalo_rendimiento' => $resultado['intervalo_rendimiento'] ?? null,
            'confianza_tipo' => $resultado['confianza_tipo'] ?? null,
        ];
        if ($kpisModelo['probabilidad_cosecha'] !== null || !empty($kpisModelo['probabilidades_cosecha']) || $kpisModelo['intervalo_rendimiento'] !== null || $kpisModelo['evaluacion_variedades'] !== null) {
            $escenarios['_zeasys_modelo'] = $kpisModelo;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO simulaciones
                (usuario_id, parcela_id, nombre, modelo_usado,
                 temperatura, humedad, precipitacion, fertilizante,
                 ph_suelo, tipo_suelo, area_simulada,
                 rendimiento_estimado, produccion_total, confianza,
                 shap_json, recomendaciones_json, categoria_cosecha, escenarios_json)
             VALUES
                (:usuario_id, :parcela_id, :nombre, :modelo_usado,
                 :temperatura, :humedad, :precipitacion, :fertilizante,
                 :ph_suelo, :tipo_suelo, :area_simulada,
                 :rendimiento_estimado, :produccion_total, :confianza,
                 :shap_json, :recomendaciones_json, :categoria_cosecha, :escenarios_json)'
        );

        $stmt->execute([
            'usuario_id'          => $datos['usuario_id'],
            'parcela_id'          => $datos['cultivo_id'] ?? null,
            'nombre'              => $datos['nombre'] ?? 'Simulación ' . date('d/m/Y H:i'),
            'modelo_usado'        => $datos['modelo_usado'] ?? 'xgboost',
            'temperatura'         => $datos['temperatura'],
            'humedad'             => $datos['humedad'],
            'precipitacion'       => $datos['precipitacion'],
            'fertilizante'        => $datos['fertilizante'],
            'ph_suelo'            => $datos['ph_suelo'],
            'tipo_suelo'          => $datos['tipo_suelo'],
            'area_simulada'       => $datos['area_simulada'],
            'rendimiento_estimado'=> $resultado['rendimiento_estimado'] ?? null,
            'produccion_total'    => $resultado['produccion_total'] ?? null,
            'confianza'           => $resultado['confianza'] ?? null,
            'shap_json'           => json_encode($resultado['shap_values'] ?? []),
            'recomendaciones_json'=> json_encode($resultado['recomendaciones'] ?? []),
            'categoria_cosecha'   => $resultado['categoria_cosecha'] ?? null,
            'escenarios_json'     => empty($escenarios)
                ? null
                : json_encode($escenarios, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null, int $desplazamiento = 0): array
    {
        $sql = 'SELECT s.*, c.nombre_parcela
                FROM simulaciones s
                LEFT JOIN parcelas c ON s.parcela_id = c.id
                WHERE s.usuario_id = :usuario_id';
        if ($year !== null) {
            $sql .= ' AND s.fecha >= :inicio AND s.fecha < :fin';
        }
        $sql .= ' ORDER BY s.fecha DESC, s.id DESC LIMIT :limite OFFSET :desplazamiento';

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('usuario_id', $usuarioId, \PDO::PARAM_INT);
        if ($year !== null) {
            $stmt->bindValue('inicio', sprintf('%04d-01-01 00:00:00', $year));
            $stmt->bindValue('fin', sprintf('%04d-01-01 00:00:00', $year + 1));
        }
        $stmt->bindValue('limite', $limite, \PDO::PARAM_INT);
        $stmt->bindValue('desplazamiento', $desplazamiento, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function obtenerAniosPorUsuario(int $usuarioId): array
    {
        $stmt = $this->db->prepare(
            'SELECT DISTINCT YEAR(fecha) AS `año` FROM simulaciones
             WHERE usuario_id = :usuario_id AND fecha >= \'2000-01-01\' AND fecha < \'2101-01-01\'
             ORDER BY `año`'
        );
        $stmt->execute(['usuario_id' => $usuarioId]);
        return array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));
    }

    public function obtenerPorId(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT s.*, c.nombre_parcela
             FROM simulaciones s
             LEFT JOIN parcelas c ON s.parcela_id = c.id
             WHERE s.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array
    {
        $sql = 'SELECT
                    COUNT(*) as total_simulaciones,
                    AVG(rendimiento_estimado) as rendimiento_promedio,
                    MAX(rendimiento_estimado) as rendimiento_maximo,
                    MIN(rendimiento_estimado) as rendimiento_minimo,
                    AVG(confianza) as confianza_promedio,
                    SUM(produccion_total) as produccion_total
                 FROM simulaciones
                 WHERE usuario_id = :usuario_id';
        if ($year !== null) {
            $sql .= ' AND fecha >= :inicio AND fecha < :fin';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('usuario_id', $usuarioId, \PDO::PARAM_INT);
        if ($year !== null) {
            $stmt->bindValue('inicio', sprintf('%04d-01-01 00:00:00', $year));
            $stmt->bindValue('fin', sprintf('%04d-01-01 00:00:00', $year + 1));
        }
        $stmt->execute();
        return $stmt->fetch();
    }

    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array
    {
        return $this->obtenerPorUsuario($usuarioId, $limite, $year);
    }

    public function obtenerRecientesPorCultivo(int $usuarioId, int $cultivoId, int $limite = 50, ?int $year = null): array
    {
        $sql = 'SELECT s.*, c.nombre_parcela FROM simulaciones s
                INNER JOIN parcelas c ON c.id = s.parcela_id
                WHERE s.usuario_id = :usuario_id AND s.parcela_id = :parcela_id
                  AND c.usuario_id = :usuario_id_cultivo';
        if ($year !== null) {
            $sql .= ' AND s.fecha >= :inicio AND s.fecha < :fin';
        }
        $sql .= ' ORDER BY s.fecha DESC, s.id DESC LIMIT :limite';
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('usuario_id', $usuarioId, \PDO::PARAM_INT);
        $stmt->bindValue('parcela_id', $cultivoId, \PDO::PARAM_INT);
        $stmt->bindValue('usuario_id_cultivo', $usuarioId, \PDO::PARAM_INT);
        if ($year !== null) {
            $stmt->bindValue('inicio', sprintf('%04d-01-01 00:00:00', $year));
            $stmt->bindValue('fin', sprintf('%04d-01-01 00:00:00', $year + 1));
        }
        $stmt->bindValue('limite', $limite, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function eliminar(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM simulaciones WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    public function contarPorUsuario(int $usuarioId): int
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM simulaciones WHERE usuario_id = :usuario_id'
        );
        $stmt->execute(['usuario_id' => $usuarioId]);
        return (int) $stmt->fetchColumn();
    }

    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $año = null): ?array
    {
        // Un año solicitado sin registros no puede reutilizar otra campaña.
        $sql = 'SELECT * FROM simulaciones WHERE parcela_id = :parcela_id';
        $params = ['parcela_id' => $cultivoId];
        if ($año !== null) {
            $sql .= ' AND fecha >= :inicio AND fecha < :fin';
            $params['inicio'] = sprintf('%04d-01-01 00:00:00', $año);
            $params['fin'] = sprintf('%04d-01-01 00:00:00', $año + 1);
        }
        $sql .= ' ORDER BY fecha DESC, id DESC LIMIT 1';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }
}
