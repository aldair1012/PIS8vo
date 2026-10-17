<?php 
 #Modelo: Simulacion#


require_once __DIR__ . '/../config/database.php';

class Simulacion
{
    private PDO $db;

    public function __construct()
    {
        $this->db = getConnection();
    }

    public function predecir(array $datos): array
    {
        $url = IA_SERVER_URL . '/predict';

        $payload = json_encode([
            'temperatura'   => (float) $datos['temperatura'],
            'humedad'       => (float) $datos['humedad'],
            'precipitacion' => (float) $datos['precipitacion'],
            'fertilizante'  => (float) $datos['fertilizante'],
            'phSuelo'       => (float) $datos['ph_suelo'],
            'area'          => (float) $datos['area_simulada'],
            'tipoSuelo'     => $datos['tipo_suelo'],
            'variedad_maiz' => $datos['variedad_maiz'] ?? 'Híbrido convencional',
            'tipo_maiz'     => $datos['tipo_maiz'] ?? 'Duro Amarillo',
            'ubicacion'     => $datos['ubicacion'] ?? '',
            'altitud'       => (float) ($datos['altitud'] ?? 45.0),
            'latitud'       => isset($datos['latitud']) ? (float) $datos['latitud'] : null,
            'longitud'      => isset($datos['longitud']) ? (float) $datos['longitud'] : null,
            'modelo'        => $datos['modelo_usado'] ?? 'xgboost'
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error'   => 'No se pudo conectar con el motor de simulación: ' . $error
            ];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'error'   => 'Error del motor de simulación (HTTP ' . $httpCode . ')'
            ];
        }

        $result = json_decode($response, true);
        return $result ?: ['success' => false, 'error' => 'Respuesta inválida del motor de simulación'];
    }

    public function guardar(array $datos, array $resultado): int
    {
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
            'escenarios_json'     => json_encode($resultado['escenarios'] ?? null)
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
        $stmt->bindValue('usuario_id', $usuarioId, PDO::PARAM_INT);
        if ($year !== null) {
            $stmt->bindValue('year', $year, PDO::PARAM_INT);
        }
        $stmt->bindValue('limite', $limite, PDO::PARAM_INT);
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
        $stmt->bindValue('usuario_id', $usuarioId, PDO::PARAM_INT);
        if ($year !== null) {
            $stmt->bindValue('year', $year, PDO::PARAM_INT);
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
}
