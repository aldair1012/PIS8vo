<?php
/**
 * Repositorio: SimulacionRepositoryMysql
 * ======================================
 * Port de models/Simulacion.php con los cambios mecánicos del plan F04 (Task 12 Step 2):
 * namespace, final + interface, PDO inyectada en el constructor (puente getConnection()
 * de deuda ADR-07, igual que UsuarioRepositoryMysql/CultivoRepositoryMysql) y sin
 * require_once de config. SQL, mensajes y firmas verbatim. El método predecir() NO se
 * portó aquí: vive en ClienteMotorFlask (puerto MotorPrediccionInterface) — así se rompe
 * la violación DIP del modelo legacy.
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
        $kpisModelo = [
            'probabilidad_cosecha' => $resultado['probabilidad_cosecha'] ?? null,
            'probabilidades_cosecha' => $resultado['probabilidades_cosecha'] ?? [],
        ];
        if ($kpisModelo['probabilidad_cosecha'] !== null || !empty($kpisModelo['probabilidades_cosecha'])) {
            $escenarios['_zeasys_modelo'] = $kpisModelo;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO simulaciones
                (usuario_id, cultivo_id, nombre, modelo_usado,
                 temperatura, humedad, precipitacion, fertilizante,
                 ph_suelo, tipo_suelo, area_simulada,
                 rendimiento_estimado, produccion_total, confianza,
                 shap_json, recomendaciones_json, categoria_cosecha, escenarios_json)
             VALUES
                (:usuario_id, :cultivo_id, :nombre, :modelo_usado,
                 :temperatura, :humedad, :precipitacion, :fertilizante,
                 :ph_suelo, :tipo_suelo, :area_simulada,
                 :rendimiento_estimado, :produccion_total, :confianza,
                 :shap_json, :recomendaciones_json, :categoria_cosecha, :escenarios_json)'
        );

        $stmt->execute([
            'usuario_id'          => $datos['usuario_id'],
            'cultivo_id'          => $datos['cultivo_id'] ?? null,
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

    public function obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null): array
    {
        $sql = 'SELECT s.*, c.nombre_parcela
                FROM simulaciones s
                LEFT JOIN cultivos c ON s.cultivo_id = c.id
                WHERE s.usuario_id = :usuario_id';
        if ($year !== null) {
            $sql .= ' AND YEAR(s.fecha) = :year';
        }
        $sql .= ' ORDER BY s.fecha DESC LIMIT :limite';

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('usuario_id', $usuarioId, \PDO::PARAM_INT);
        if ($year !== null) {
            $stmt->bindValue('year', $year, \PDO::PARAM_INT);
        }
        $stmt->bindValue('limite', $limite, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function obtenerPorId(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT s.*, c.nombre_parcela
             FROM simulaciones s
             LEFT JOIN cultivos c ON s.cultivo_id = c.id
             WHERE s.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function obtenerEstadisticas(int $usuarioId, ?int $year = null): array
    {
        $sql = 'SELECT
                    COUNT(*) as total_simulaciones,
                    COALESCE(AVG(rendimiento_estimado), 0) as rendimiento_promedio,
                    COALESCE(MAX(rendimiento_estimado), 0) as rendimiento_maximo,
                    COALESCE(MIN(rendimiento_estimado), 0) as rendimiento_minimo,
                    COALESCE(AVG(confianza), 0) as confianza_promedio,
                    COALESCE(SUM(produccion_total), 0) as produccion_total
                 FROM simulaciones
                 WHERE usuario_id = :usuario_id';
        if ($year !== null) {
            $sql .= ' AND YEAR(fecha) = :year';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('usuario_id', $usuarioId, \PDO::PARAM_INT);
        if ($year !== null) {
            $stmt->bindValue('year', $year, \PDO::PARAM_INT);
        }
        $stmt->execute();
        return $stmt->fetch();
    }

    public function obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array
    {
        return $this->obtenerPorUsuario($usuarioId, $limite, $year);
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

    public function obtenerUltimaPorCultivo(int $cultivoId, ?int $anio = null): ?array
    {
        // Port verbatim del SQL inline de SimulacionController::explain() (líneas 249–265).
        $sql = 'SELECT * FROM simulaciones WHERE cultivo_id = :cultivo_id';
        $params = ['cultivo_id' => $cultivoId];
        if ($anio) {
            $sql .= ' AND YEAR(fecha) = :year';
            $params['year'] = $anio;
        }
        $sql .= ' ORDER BY fecha DESC LIMIT 1';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $simulacionInfo = $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;

        if (!$simulacionInfo) {
            $stmt2 = $this->db->prepare('SELECT * FROM simulaciones WHERE cultivo_id = :cultivo_id ORDER BY fecha DESC LIMIT 1');
            $stmt2->execute(['cultivo_id' => $cultivoId]);
            $simulacionInfo = $stmt2->fetch(\PDO::FETCH_ASSOC) ?: null;
        }

        return $simulacionInfo;
    }
}
