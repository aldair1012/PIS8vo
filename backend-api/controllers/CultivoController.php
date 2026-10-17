<?php
// CultivoController.php - CRUD para registrar, editar y borrar lotes (parcelas) de maíz.

require_once __DIR__ . '/../models/Cultivo.php';

class CultivoController
{
    private Cultivo $cultivo;

    public function __construct()
    {
        $this->cultivo = new Cultivo();
    }

    private function getAuthUserOrError()
    {
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        return $_SESSION['usuario_id'];
    }

    public function listar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();
        $cultivos = $this->cultivo->obtenerPorUsuario($usuarioId);
        echo json_encode($cultivos, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function crear(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        $datos = [
            'usuario_id'     => $usuarioId,
            'nombre_parcela' => trim($data['nombre_parcela'] ?? ''),
            'variedad_maiz'  => trim($data['variedad_maiz'] ?? 'Híbrido convencional'),
            'tipo_maiz'      => trim($data['tipo_maiz'] ?? 'Duro Amarillo'),
            'ubicacion'      => trim($data['ubicacion'] ?? ''),
            'area'           => floatval($data['area'] ?? 0),
            'latitud'        => !empty($data['latitud']) ? floatval($data['latitud']) : null,
            'longitud'       => !empty($data['longitud']) ? floatval($data['longitud']) : null,
            'fecha_siembra'  => !empty($data['fecha_siembra']) ? $data['fecha_siembra'] : null,
            'geojson'        => !empty($data['geojson']) ? trim($data['geojson']) : null,
            'altitud'        => !empty($data['altitud']) ? floatval($data['altitud']) : null,
            'ph'             => (!empty($data['ph']) && floatval($data['ph']) > 0) ? floatval($data['ph']) : 6.5,
            'fertilizacion_fecha' => !empty($data['fertilizacion_fecha']) ? $data['fertilizacion_fecha'] : null,
            'fertilizacion_dosis' => isset($data['fertilizacion_dosis']) ? floatval($data['fertilizacion_dosis']) : null,
            'fertilizacion_tipo'  => !empty($data['fertilizacion_tipo']) ? trim($data['fertilizacion_tipo']) : null
        ];

        if (empty($datos['nombre_parcela'])) {
            http_response_code(400);
            echo json_encode(['error' => 'El nombre de la parcela es obligatorio.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['area'] <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'El área debe ser mayor a 0.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['latitud'] === null || $datos['latitud'] < -5.2 || $datos['latitud'] > 1.6 ||
            $datos['longitud'] === null || $datos['longitud'] < -81.6 || $datos['longitud'] > -75.0) {
            http_response_code(400);
            echo json_encode(['error' => 'Las coordenadas del lote están fuera del cuadrante de Ecuador continental (Latitud: [-5.2, 1.6], Longitud: [-81.6, -75.0]). El sistema DSS está restringido únicamente a parcelas dentro del territorio ecuatoriano.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $id = $this->cultivo->crear($datos);
            $datos['id'] = $id;
            echo json_encode([
                'success' => true,
                'message' => 'Parcela registrada exitosamente.',
                'cultivo' => $datos
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al registrar la parcela: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function actualizar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        $id = intval($data['id'] ?? ($_GET['id'] ?? 0));
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de parcela inválido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $cultivo = $this->cultivo->obtenerPorId($id);
        if (!$cultivo || $cultivo['usuario_id'] != $usuarioId) {
            http_response_code(403);
            echo json_encode(['error' => 'No tiene permisos para editar esta parcela.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $datos = [
            'nombre_parcela' => trim($data['nombre_parcela'] ?? $cultivo['nombre_parcela']),
            'variedad_maiz'  => trim($data['variedad_maiz'] ?? $cultivo['variedad_maiz']),
            'tipo_maiz'      => trim($data['tipo_maiz'] ?? $cultivo['tipo_maiz']),
            'ubicacion'      => trim($data['ubicacion'] ?? $cultivo['ubicacion']),
            'area'           => floatval($data['area'] ?? $cultivo['area']),
            'latitud'        => isset($data['latitud']) ? floatval($data['latitud']) : ($cultivo['latitud'] !== null ? floatval($cultivo['latitud']) : null),
            'longitud'       => isset($data['longitud']) ? floatval($data['longitud']) : ($cultivo['longitud'] !== null ? floatval($cultivo['longitud']) : null),
            'fecha_siembra'  => isset($data['fecha_siembra']) ? $data['fecha_siembra'] : $cultivo['fecha_siembra'],
            'geojson'        => isset($data['geojson']) ? trim($data['geojson']) : $cultivo['geojson'],
            'altitud'        => isset($data['altitud']) ? floatval($data['altitud']) : ($cultivo['altitud'] !== null ? floatval($cultivo['altitud']) : null),
            'ph'             => isset($data['ph']) ? floatval($data['ph']) : ($cultivo['ph'] !== null ? floatval($cultivo['ph']) : null),
            'fertilizacion_fecha' => isset($data['fertilizacion_fecha']) ? $data['fertilizacion_fecha'] : $cultivo['fertilizacion_fecha'],
            'fertilizacion_dosis' => isset($data['fertilizacion_dosis']) ? floatval($data['fertilizacion_dosis']) : ($cultivo['fertilizacion_dosis'] !== null ? floatval($cultivo['fertilizacion_dosis']) : null),
            'fertilizacion_tipo'  => isset($data['fertilizacion_tipo']) ? trim($data['fertilizacion_tipo']) : $cultivo['fertilizacion_tipo']
        ];

        if (empty($datos['nombre_parcela'])) {
            http_response_code(400);
            echo json_encode(['error' => 'El nombre de la parcela es obligatorio.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['area'] <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'El área debe ser mayor a 0.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['latitud'] !== null && ($datos['latitud'] < -5.2 || $datos['latitud'] > 1.6) ||
            $datos['longitud'] !== null && ($datos['longitud'] < -81.6 || $datos['longitud'] > -75.0)) {
            http_response_code(400);
            echo json_encode(['error' => 'Las coordenadas del lote están fuera del cuadrante de Ecuador continental (Latitud: [-5.2, 1.6], Longitud: [-81.6, -75.0]). El sistema DSS está restringido únicamente a parcelas dentro del territorio ecuatoriano.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $this->cultivo->actualizar($id, $datos);
            $datos['id'] = $id;
            echo json_encode([
                'success' => true,
                'message' => 'Parcela actualizada exitosamente.',
                'cultivo' => $datos
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al actualizar: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function eliminar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de parcela inválido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $cultivo = $this->cultivo->obtenerPorId($id);
        if (!$cultivo || $cultivo['usuario_id'] != $usuarioId) {
            http_response_code(403);
            echo json_encode(['error' => 'No tiene permisos para eliminar esta parcela.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $this->cultivo->eliminar($id);
            echo json_encode(['success' => true, 'message' => 'Parcela eliminada correctamente.'], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al eliminar: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function mapa(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $this->getAuthUserOrError();
        $cultivos = $this->cultivo->obtenerConCoordenadas();
        echo json_encode($cultivos, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function obtenerValoresUbicacion(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        $cultivo = $this->cultivo->obtenerPorId($id);

        if (!$cultivo || $cultivo['usuario_id'] != $usuarioId) {
            http_response_code(403);
            echo json_encode(['error' => 'No tiene permisos para acceder a esta parcela.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $lat = !empty($cultivo['latitud']) ? floatval($cultivo['latitud']) : null;
        $lng = !empty($cultivo['longitud']) ? floatval($cultivo['longitud']) : null;

        $clima = [
            'temperatura' => 24.5,
            'humedad' => 68.0,
            'precipitacion' => 750.0
        ];
        $suelo = [
            'ph' => !empty($cultivo['ph']) ? floatval($cultivo['ph']) : 6.5,
            'tipo_suelo' => 'franco'
        ];
        $fuente = 'Valores por defecto del cultivo';

        if ($lat !== null && $lng !== null) {
            try {
                require_once __DIR__ . '/ClimateController.php';
                $controladorClima = new ClimateController();
                $altitud = !empty($cultivo['altitud']) ? floatval($cultivo['altitud']) : null;
                $datosApi = $controladorClima->consultarDatosApiPrecision($lat, $lng, $altitud);

                if (isset($datosApi['clima'])) {
                    $clima['temperatura'] = $datosApi['clima']['temperatura'];
                    $clima['humedad'] = $datosApi['clima']['humedad'];
                    $clima['precipitacion'] = $datosApi['clima']['precipitacion'];
                }

                if (empty($cultivo['ph']) && isset($datosApi['suelo']['ph'])) {
                    $suelo['ph'] = $datosApi['suelo']['ph'];
                }

                if (isset($datosApi['suelo'])) {
                    $arcilla = $datosApi['suelo']['clay'] ?? 30;
                    $arena = $datosApi['suelo']['sand'] ?? 40;
                    if ($arcilla > 35) {
                        $suelo['tipo_suelo'] = 'arcilloso';
                    } elseif ($arena > 50) {
                        $suelo['tipo_suelo'] = 'arenoso';
                    } else {
                        $suelo['tipo_suelo'] = 'franco';
                    }
                }
                $fuente = $datosApi['source'] ?? 'Open-Meteo & SoilGrids';
            } catch (Exception $e) {
                $fuente = 'Fallback por error en API: ' . $e->getMessage();
            }
        }

        echo json_encode([
            'success' => true,
            'source' => $fuente,
            'temperatura' => $clima['temperatura'],
            'humedad' => $clima['humedad'],
            'precipitacion' => $clima['precipitacion'],
            'ph_suelo' => $suelo['ph'],
            'tipo_suelo' => $suelo['tipo_suelo'],
            'area_simulada' => !empty($cultivo['area']) ? floatval($cultivo['area']) : 1.0
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
