<?php
// SimulacionController.php - Controlador principal para correr las predicciones (con Flask/ML) y generar las explicaciones recomendadas.

require_once __DIR__ . '/../models/Simulacion.php';
require_once __DIR__ . '/../models/Cultivo.php';
require_once __DIR__ . '/../helpers/IaServerHelper.php';

class SimulacionController
{
    private Simulacion $simulacion;
    private Cultivo $cultivo;

    public function __construct()
    {
        $this->simulacion = new Simulacion();
        $this->cultivo    = new Cultivo();
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

    private function limpiarCacheExpirada(): void
    {
        $cacheDir = __DIR__ . '/../data/cache';
        if (!is_dir($cacheDir)) {
            return;
        }
        
        $files = glob($cacheDir . '/precision_data_*.json');
        if (!$files) {
            return;
        }

        $now = time();
        $expiredTime = 24 * 3600; // 24 horas

        foreach ($files as $file) {
            if (is_file($file)) {
                $fileAge = $now - filemtime($file);
                if ($fileAge > $expiredTime) {
                    @unlink($file);
                }
            }
        }
    }

    public function simular(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        $datos = [
            'usuario_id'    => $usuarioId,
            'cultivo_id'    => !empty($data['cultivo_id']) ? intval($data['cultivo_id']) : null,
            'nombre'        => trim($data['nombre'] ?? 'Simulación ' . date('d/m/Y H:i')),
            'modelo_usado'  => $data['modelo_usado'] ?? 'xgboost',
            'temperatura'   => isset($data['temperatura']) ? floatval($data['temperatura']) : 0.0,
            'humedad'       => isset($data['humedad']) ? floatval($data['humedad']) : 0.0,
            'precipitacion' => isset($data['precipitacion']) ? floatval($data['precipitacion']) : 0.0,
            'fertilizante'  => isset($data['fertilizante']) ? floatval($data['fertilizante']) : 0.0,
            'ph_suelo'      => isset($data['ph_suelo']) ? floatval($data['ph_suelo']) : 0.0,
            'tipo_suelo'    => $data['tipo_suelo'] ?? 'franco',
            'area_simulada' => isset($data['area_simulada']) ? floatval($data['area_simulada']) : 1.0
        ];

        if (empty($datos['cultivo_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Debe seleccionar una parcela registrada para realizar la simulación.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $c = $this->cultivo->obtenerPorId($datos['cultivo_id']);
        if (!$c || $c['usuario_id'] != $usuarioId) {
            http_response_code(403);
            echo json_encode(['error' => 'La parcela seleccionada es inválida o no le pertenece.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $datos['variedad_maiz'] = $c['variedad_maiz'] ?? 'Híbrido convencional';
        $datos['tipo_maiz'] = $c['tipo_maiz'] ?? 'Duro Amarillo';
        $datos['ubicacion'] = $c['ubicacion'] ?? '';
        $datos['altitud'] = $c['altitud'] ?? 45.0;
        $datos['latitud'] = $c['latitud'] ?? null;
        $datos['longitud'] = $c['longitud'] ?? null;

        // Validaciones
        if ($datos['temperatura'] < 0 || $datos['temperatura'] > 50) {
            http_response_code(400);
            echo json_encode(['error' => 'La temperatura debe estar entre 0°C y 50°C.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['humedad'] < 0 || $datos['humedad'] > 100) {
            http_response_code(400);
            echo json_encode(['error' => 'La humedad debe estar entre 0% y 100%.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['precipitacion'] < 0 || $datos['precipitacion'] > 4000) {
            http_response_code(400);
            echo json_encode(['error' => 'La precipitación debe estar entre 0 y 4000 mm/año.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['fertilizante'] < 0 || $datos['fertilizante'] > 500) {
            http_response_code(400);
            echo json_encode(['error' => 'El fertilizante debe estar entre 0 y 500 kg/ha.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['ph_suelo'] < 3.0 || $datos['ph_suelo'] > 11.0) {
            http_response_code(400);
            echo json_encode(['error' => 'El pH debe estar entre 3.0 y 11.0.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($datos['area_simulada'] <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'El área simulada debe ser mayor a 0.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Asegurar que el servidor de IA esté activo
        $iaStatus = IaServerHelper::ensureRunning();
        if (!$iaStatus['running']) {
            http_response_code(503);
            echo json_encode(['error' => 'El motor de simulación está inactivo: ' . $iaStatus['message']], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $resultado = $this->simulacion->predecir($datos);

        if (!isset($resultado['success']) || !$resultado['success']) {
            http_response_code(502);
            echo json_encode(['error' => $resultado['error'] ?? 'Error al comunicarse con el motor de simulación.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $id = $this->simulacion->guardar($datos, $resultado);
            $resultado['simulacion_id'] = $id;

            echo json_encode([
                'success' => true,
                'message' => 'Simulación completada exitosamente.',
                'resultado' => $resultado
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al guardar la simulación: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function historial(): void
    {
        $this->limpiarCacheExpirada();
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $year = isset($_GET['anio']) && $_GET['anio'] !== '' ? intval($_GET['anio']) : null;
        $simulaciones = $this->simulacion->obtenerPorUsuario($usuarioId, 100, $year);
        $estadisticas = $this->simulacion->obtenerEstadisticas($usuarioId, $year);

        echo json_encode([
            'simulaciones' => $simulaciones,
            'estadisticas' => $estadisticas
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function eliminar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de simulación inválido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $simulacion = $this->simulacion->obtenerPorId($id);
        if (!$simulacion || $simulacion['usuario_id'] != $usuarioId) {
            http_response_code(403);
            echo json_encode(['error' => 'No tiene permisos para eliminar esta simulación.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $this->simulacion->eliminar($id);
            echo json_encode(['success' => true, 'message' => 'Simulación eliminada correctamente.'], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al eliminar la simulación: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function iaStatus(): void
    {
        $this->limpiarCacheExpirada();
        header('Content-Type: application/json; charset=utf-8');
        $tryStart = isset($_GET['start']) && $_GET['start'] === '1';
        $status = IaServerHelper::getStatus($tryStart);
        echo json_encode($status, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function explain(): void
    {
        @set_time_limit(240);
        header('Content-Type: application/json; charset=utf-8');
        $usuarioId = $this->getAuthUserOrError();

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        if (empty($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'No se recibieron datos de contexto para interpretar.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Obtener cultivo_id y anio
        $cultivoId = isset($data['cultivo_id']) && $data['cultivo_id'] !== '' ? intval($data['cultivo_id']) : null;
        $anio = isset($data['anio']) && $data['anio'] !== '' ? intval($data['anio']) : null;

        $cultivoInfo = null;
        $simulacionInfo = null;

        if ($cultivoId) {
            $cultivoInfo = $this->cultivo->obtenerPorId($cultivoId);
            $db = getConnection();

            $sql = 'SELECT * FROM simulaciones WHERE cultivo_id = :cultivo_id';
            $params = ['cultivo_id' => $cultivoId];
            if ($anio) {
                $sql .= ' AND YEAR(fecha) = :year';
                $params['year'] = $anio;
            }
            $sql .= ' ORDER BY fecha DESC LIMIT 1';

            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $simulacionInfo = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

            if (!$simulacionInfo) {
                $stmt2 = $db->prepare('SELECT * FROM simulaciones WHERE cultivo_id = :cultivo_id ORDER BY fecha DESC LIMIT 1');
                $stmt2->execute(['cultivo_id' => $cultivoId]);
                $simulacionInfo = $stmt2->fetch(PDO::FETCH_ASSOC) ?: null;
            }
        }

        $nombreParcela = !empty($cultivoInfo['nombre_parcela']) ? $cultivoInfo['nombre_parcela'] : 'tu parcela';
        $variedadMaiz = !empty($cultivoInfo['variedad_maiz']) ? $cultivoInfo['variedad_maiz'] : 'Híbrido Convencional';
        $ubicacionRaw = !empty($cultivoInfo['ubicacion']) ? $cultivoInfo['ubicacion'] : 'tu zona';
        
        // Limpiar ubicacion
        $ubicacionPartes = preg_split('/[\-\|]/', $ubicacionRaw);
        $ubicacion = trim($ubicacionPartes[0]);
        if (empty($ubicacion)) $ubicacion = 'tu zona';

        $areaHa = !empty($cultivoInfo['area']) ? floatval($cultivoInfo['area']) : 1.0;
        
        $phSuelo = floatval($simulacionInfo['ph_suelo'] ?? ($data['ph_suelo'] ?? 6.2));
        $fertilizanteVal = floatval($simulacionInfo['fertilizante'] ?? ($data['fertilizante'] ?? 150));
        $temperaturaVal = floatval($simulacionInfo['temperatura'] ?? ($data['temperatura'] ?? 24.5));
        $precipitacionVal = floatval($simulacionInfo['precipitacion'] ?? ($data['precipitacion'] ?? 800));
        $humedadVal = floatval($simulacionInfo['humedad'] ?? ($data['humedad'] ?? 70));
        $tipoSuelo = !empty($simulacionInfo['tipo_suelo']) ? $simulacionInfo['tipo_suelo'] : 'franco';
        $rendPredichoVal = round(floatval($simulacionInfo['rendimiento_estimado'] ?? ($data['rendimiento_estimado'] ?? 7.5)), 2);

        // Campos enviados por la tarjeta
        $nombre = trim($data['nombre'] ?? ($data['titulo'] ?? 'Indicador'));
        $valor = isset($data['valor']) ? trim((string)$data['valor']) : '';
        $unidad = isset($data['unidad']) ? trim((string)$data['unidad']) : '';
        $estado = trim($data['estado'] ?? ($data['nivel'] ?? 'normal'));
        $rangoIdeal = trim($data['rango_ideal'] ?? '');
        $descripcionTecnica = trim($data['descripcion_tecnica'] ?? '');
        $impactoBase = trim($data['impacto_base'] ?? '');
        $recomendacionBase = trim($data['recomendacion_base'] ?? '');

        // Armar valor con unidad sin duplicar
        if (!empty($unidad) && strpos($valor, $unidad) !== false) {
            $valorConUnidad = $valor;
        } else {
            $valorConUnidad = trim("$valor $unidad");
        }

        // Nivel del resultado
        $nivelText = 'regular';
        $estadoLower = mb_strtolower($estado, 'UTF-8');
        if (in_array($estadoLower, ['bajo', 'alto', 'riesgoso', 'riesgo', 'critico', 'malo', 'desfavorable', 'level-danger', 'insuficiente'])) {
            $nivelText = 'riesgoso';
        } elseif (in_array($estadoLower, ['optimo', 'ideal', 'bueno', 'excelente', 'favorable', 'adecuado', 'level-success'])) {
            $nivelText = 'favorable';
        }

        // Calcular factor limitante para tarjetas que lo necesiten
        $potencialMax = 11.2;
        $lossN = max(0, round(((180 - $fertilizanteVal) / 180) * 2.8, 2));
        $lossWater = max(0, round(((750 - $precipitacionVal) / 750) * 2.5, 2));
        
        $lossPh = 0;
        if ($phSuelo < 5.8) {
            $lossPh = round((5.8 - $phSuelo) * 1.4, 2);
        } elseif ($phSuelo > 7.2) {
            $lossPh = round(($phSuelo - 7.2) * 1.1, 2);
        }

        $lossTemp = 0;
        if ($temperaturaVal > 30.0) {
            $lossTemp = round(($temperaturaVal - 30.0) * 0.4, 2);
        }

        $losses = [
            'nitrogeno' => ['nombre' => 'Nitrógeno', 'perdida' => $lossN, 'detalle' => "$fertilizanteVal kg/ha aplicados vs 180 kg/ha recomendados"],
            'agua' => ['nombre' => 'Lluvia', 'perdida' => $lossWater, 'detalle' => "$precipitacionVal mm/año registrados vs 750 mm/año óptimo"],
            'ph' => ['nombre' => 'pH del Suelo', 'perdida' => $lossPh, 'detalle' => "pH $phSuelo vs rango ideal 5.8 - 6.8"],
            'temperatura' => ['nombre' => 'Temperatura', 'perdida' => $lossTemp, 'detalle' => "$temperaturaVal °C vs rango ideal 21 - 27 °C"]
        ];
        uasort($losses, function($a, $b) { return $b['perdida'] <=> $a['perdida']; });
        $principalItem = current($losses);
        $principalNombre = $principalItem['nombre'];
        $principalPerdida = max(0.4, $principalItem['perdida']);
        $principalDetalle = $principalItem['detalle'];

        $perdidaDolaresHa = round($principalPerdida * 22 * 16.50, 2);

        $nombreLower = mb_strtolower($nombre, 'UTF-8');
        $secciones = [];

        // =============================================================
        // GRAFICOS (cascada, curva, gauss, sensibilidad)
        // =============================================================
        if (isset($data['datos_grafico'])) {
            $dg = $data['datos_grafico'];

            // Cascada de Brechas
            if (strpos($nombreLower, 'cascada') !== false || strpos($nombreLower, 'brecha') !== false || strpos($nombreLower, 'limitante') !== false || strpos($nombreLower, 'contribuci') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuál es la limitante principal de tu lote?", 'tipo' => 'danger',
                     'contenido' => "En tu parcela $nombreParcela, el factor que más frena tu cosecha es **$principalNombre** ($principalDetalle). Te resta **-$principalPerdida t/ha** del rendimiento potencial de $potencialMax t/ha."],
                    ['titulo' => "2. ¿Cuánto dinero pierdes por esta limitante?", 'tipo' => 'warning',
                     'contenido' => "Esa pérdida de -$principalPerdida t/ha equivale a dejar de ingresar **-$perdidaDolaresHa USD por hectárea** (al precio de $16.50 USD/qq, con 22 quintales por tonelada)."],
                    ['titulo' => "3. ¿Qué puedes hacer para reducir esta brecha?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Enfoca tu inversión en corregir $principalNombre antes de agregar otros insumos, ya que es el cuello de botella que más impacto tiene en tu rendimiento."],
                    ['titulo' => "4. Seguimiento recomendado", 'tipo' => 'info',
                     'contenido' => "Después de aplicar la corrección, vuelve a correr la simulación para verificar que la brecha se redujo y que tu cosecha estimada subió."]
                ];
            }
            // Curva Temporal de Rendimiento
            elseif (strpos($nombreLower, 'curva') !== false && isset($dg['labels'])) {
                $actual = $dg['proyeccion_actual'] ?? [];
                $mejor = $dg['mejor_ano'] ?? [];
                $finalIdx = count($dg['labels'] ?? []) - 1;
                $valAct = round($actual[$finalIdx] ?? $rendPredichoVal, 2);
                $valMejor = round($mejor[$finalIdx] ?? 9.8, 2);
                $diff = round($valMejor - $valAct, 2);

                $secciones = [
                    ['titulo' => "1. Tu cosecha proyectada vs el mejor año histórico", 'tipo' => 'info',
                     'contenido' => "La curva de rendimiento acumulado de tu variedad $variedadMaiz en $nombreParcela proyecta una cosecha final de **$valAct t/ha**. El mejor año registrado en $ubicacion alcanzó **$valMejor t/ha**, una diferencia de **$diff t/ha**."],
                    ['titulo' => "2. ¿Qué explica esa diferencia de $diff t/ha?", 'tipo' => $valAct >= $valMejor ? 'success' : 'warning',
                     'contenido' => $valAct >= $valMejor
                        ? "Tu manejo actual con $fertilizanteVal kg/ha de fertilizante y $precipitacionVal mm de lluvia está generando condiciones iguales o mejores que el año récord."
                        : "La combinación de $fertilizanteVal kg/ha de fertilizante y $precipitacionVal mm de lluvia no alcanza las condiciones del mejor año. El llenado de grano entre los días 60 y 90 es la etapa donde más se pierde."],
                    ['titulo' => "3. ¿Cómo cerrar esa brecha?", 'tipo' => 'success',
                     'contenido' => "Aplica la segunda dosis de Nitrógeno (60 kg/ha) 10 días antes de la floración (V8) y asegura humedad constante en el suelo durante la emisión de la espiga."]
                ];
            }
            // Distribución Probabilística (Gauss / MonteCarlo)
            elseif (strpos($nombreLower, 'gauss') !== false || strpos($nombreLower, 'probabil') !== false || strpos($nombreLower, 'distribuc') !== false) {
                $rawP50 = isset($dg['p50']) && floatval($dg['p50']) > 0 ? floatval($dg['p50']) : $rendPredichoVal;
                $rawP10 = isset($dg['p10']) && floatval($dg['p10']) > 0 ? floatval($dg['p10']) : ($rawP50 * 0.72);
                $rawP90 = isset($dg['p90']) && floatval($dg['p90']) > 0 ? floatval($dg['p90']) : ($rawP50 * 1.28);

                if (abs($rawP90 - $rawP10) < 0.3) {
                    $rawP10 = max(2.1, round($rawP50 * 0.72, 2));
                    $rawP90 = round($rawP50 * 1.28, 2);
                }

                $p10 = round($rawP10, 2);
                $p50 = round($rawP50, 2);
                $p90 = round($rawP90, 2);
                $rango = round($p90 - $p10, 2);

                $secciones = [
                    ['titulo' => "1. Los 3 escenarios de cosecha posibles", 'tipo' => 'info',
                     'contenido' => "Tu cosecha más probable es **$p50 t/ha**. En un año con clima favorable podrías alcanzar hasta **$p90 t/ha**, pero si hay sequía o lluvias excesivas en $ubicacion, la cosecha podría caer a **$p10 t/ha**."],
                    ['titulo' => "2. ¿Qué tan amplio es el riesgo?", 'tipo' => 'warning',
                     'contenido' => "La diferencia entre el mejor y peor escenario es de **$rango t/ha**. Cuanto más grande sea este rango, más depende tu cosecha de factores climáticos que no puedes controlar."],
                    ['titulo' => "3. ¿Cómo reducir la incertidumbre?", 'tipo' => 'success',
                     'contenido' => "Para elevar el piso pesimista de $p10 t/ha, incorpora materia orgánica al suelo $tipoSuelo para retener más agua y considera semillas tolerantes a sequía para la próxima campaña."]
                ];
            }
            // Sensibilidad Financiera
            elseif (strpos($nombreLower, 'sensibilidad') !== false) {
                $margenes = array_column($dg, 'margen');
                $maxMargen = !empty($margenes) ? round(max($margenes), 2) : 850;
                $minMargen = !empty($margenes) ? round(min($margenes), 2) : -120;

                $secciones = [
                    ['titulo' => "1. ¿Cuánto puedes ganar o perder según el precio?", 'tipo' => 'info',
                     'contenido' => "Si el precio del maíz sube y mantienes tu rendimiento de $rendPredichoVal t/ha, tu ganancia puede alcanzar **+$maxMargen USD/ha**. Si el precio baja al mínimo, tu margen se reduce a **$minMargen USD/ha**."],
                    ['titulo' => "2. ¿Por qué varía tanto tu ganancia?", 'tipo' => 'warning',
                     'contenido' => "Tu margen es sensible porque tus costos de producción incluyen $fertilizanteVal kg/ha de fertilizante. Si el precio del maíz cae por debajo de $14.50 USD/qq, tus costos pueden superar tus ingresos."],
                    ['titulo' => "3. ¿Cómo protegerte de una caída de precios?", 'tipo' => 'success',
                     'contenido' => "Pacta contratos de venta anticipada fijando un precio mínimo de $16.50 USD/qq y reduce costos variables optimizando la dosis de fertilizante sin sacrificar rendimiento."]
                ];
            }
        }

        // =============================================================
        // TARJETAS INDIVIDUALES POR TIPO
        // =============================================================
        if (empty($secciones)) {

            // --- RENDIMIENTO POTENCIAL / GENETICO ---
            if (strpos($nombreLower, 'potencial') !== false || strpos($nombreLower, 'genético') !== false || strpos($nombreLower, 'genetico') !== false || strpos($nombreLower, 'límite genético') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué significa el Rendimiento Potencial de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "El valor de **$valorConUnidad** es el máximo que la semilla de tu variedad $variedadMaiz puede producir bajo condiciones perfectas de laboratorio: sin plagas, con agua y nutrientes ilimitados. Es un techo teórico, no una meta de campo."],
                    ['titulo' => "2. ¿Qué tan lejos estás de ese techo?", 'tipo' => $rendPredichoVal > ($potencialMax * 0.7) ? 'success' : 'warning',
                     'contenido' => "Tu simulación estima una cosecha de **$rendPredichoVal t/ha**, lo que significa que estás aprovechando el **" . round(($rendPredichoVal / max(0.1, floatval(str_replace([' t/ha', ' '], '', $valor)))) * 100, 0) . "%** del potencial genético de la semilla."],
                    ['titulo' => "3. ¿Cómo acercarte más al potencial?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Para cerrar la brecha entre $rendPredichoVal t/ha y $valorConUnidad, enfócate en corregir tu factor limitante principal: **$principalNombre** ($principalDetalle)."]
                ];
            }
            // --- RADIACION FOTOSINTETICA ---
            elseif (strpos($nombreLower, 'radiación') !== false || strpos($nombreLower, 'radiacion') !== false || strpos($nombreLower, 'par') !== false || strpos($nombreLower, 'fotosint') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué es la Radiación Fotosintética de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "El valor de **$valorConUnidad** mide la energía solar que las hojas de tu maíz capturan para convertirla en azúcares y almidón. El maíz es una planta C4 que necesita mucha luz solar para producir grano pesado."],
                    ['titulo' => "2. ¿Tu cultivo está recibiendo suficiente luz?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Con **$valorConUnidad**, tu canopia tiene buena captura de luz. El rango ideal está entre " . (!empty($rangoIdeal) ? $rangoIdeal : "380 y 450 cal/cm²") . "."],
                    ['titulo' => "3. ¿Cómo mejorar la captura de luz?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Mantén una densidad de siembra de 65,000 a 70,000 plantas/ha para que las hojas cubran el suelo uniformemente y capturen toda la luz disponible."]
                ];
            }
            // --- RENDIMIENTO ALCANZABLE ---
            elseif (strpos($nombreLower, 'alcanzable') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué es el Rendimiento Alcanzable de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "A diferencia del potencial genético, el rendimiento alcanzable de **$valorConUnidad** ya considera las limitaciones reales de tu suelo $tipoSuelo y el clima de $ubicacion. Es la meta realista que puedes lograr con buen manejo."],
                    ['titulo' => "2. ¿Estás cerca de alcanzarlo?", 'tipo' => $rendPredichoVal >= floatval(str_replace([' t/ha', ' '], '', $valor)) * 0.85 ? 'success' : 'warning',
                     'contenido' => "Tu cosecha estimada de **$rendPredichoVal t/ha** representa el **" . round(($rendPredichoVal / max(0.1, floatval(str_replace([' t/ha', ' '], '', $valor)))) * 100, 0) . "%** de lo alcanzable. " . ($rendPredichoVal >= floatval(str_replace([' t/ha', ' '], '', $valor)) * 0.85 ? "Estás en buen camino." : "Hay espacio para mejorar optimizando tu factor limitante.")],
                    ['titulo' => "3. ¿Qué falta para alcanzar los $valorConUnidad?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Ajusta la fertilización a 180 kg/ha de Nitrógeno fraccionado y asegura riegos complementarios si la lluvia está por debajo de 600 mm en tu zona."]
                ];
            }
            // --- CAPACIDAD DE SUELO / TEXTURA ---
            elseif (strpos($nombreLower, 'capacidad') !== false && strpos($nombreLower, 'suelo') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué tipo de suelo tiene tu parcela?", 'tipo' => 'info',
                     'contenido' => "Tu suelo es de textura **$valor** en la parcela $nombreParcela. Este tipo de suelo determina cuánta agua puede retener para que las raíces la absorban entre lluvias."],
                    ['titulo' => "2. ¿Cómo afecta esto a tu maíz?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Un suelo $tipoSuelo retiene agua de forma moderada. Si llega una semana seca, tus plantas tienen reserva hídrica para resistir sin marchitarse."],
                    ['titulo' => "3. ¿Cómo cuidar la estructura de tu suelo?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Evita pasar maquinaria pesada cuando el suelo esté húmedo para no compactarlo. Incorpora rastrojos después de la cosecha para mejorar la porosidad."]
                ];
            }
            // --- AGUA UTIL / BALANCE HIDRICO ---
            elseif (strpos($nombreLower, 'agua') !== false || strpos($nombreLower, 'hídric') !== false || strpos($nombreLower, 'hidric') !== false || strpos($nombreLower, 'balance') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánta agua necesita tu cultivo?", 'tipo' => 'info',
                     'contenido' => "Tu maíz variedad $variedadMaiz necesita **$valorConUnidad** de agua durante todo su ciclo de 120 días. " . (!empty($rangoIdeal) ? "El rango adecuado es $rangoIdeal." : "Lo ideal son entre 450 y 550 mm.")],
                    ['titulo' => "2. ¿Tu zona cubre esa necesidad?", 'tipo' => $precipitacionVal >= 600 ? 'success' : 'danger',
                     'contenido' => "En $ubicacion se registran **$precipitacionVal mm/año** de lluvia. " . ($precipitacionVal >= 600 ? "Esto cubre la mayor parte de la demanda hídrica del cultivo." : "Esto está por debajo de lo necesario, lo que puede causar estrés hídrico durante la floración.")],
                    ['titulo' => "3. ¿Qué hacer si falta agua?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Programa riegos de auxilio de 25-30 mm en la etapa V8 a VT (floración) que es cuando la planta más agua consume."]
                ];
            }
            // --- RENDIMIENTO PREDICHO ---
            elseif (strpos($nombreLower, 'predicho') !== false || strpos($nombreLower, 'estimado') !== false || strpos($nombreLower, 'cosecha esperada') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánto maíz vas a cosechar?", 'tipo' => 'info',
                     'contenido' => "La simulación estima que vas a cosechar **$valorConUnidad** en tu parcela $nombreParcela ($areaHa ha) con la variedad $variedadMaiz. " . ($rendPredichoVal > 6.0 ? "Este es un rendimiento competitivo para la zona de $ubicacion." : "Este rendimiento está por debajo del promedio de $ubicacion.")],
                    ['titulo' => "2. ¿Qué variables determinaron este resultado?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => "El modelo consideró: temperatura de **$temperaturaVal °C**, lluvia de **$precipitacionVal mm**, fertilización de **$fertilizanteVal kg/ha** y pH de **$phSuelo**. Tu factor más débil es **$principalNombre** ($principalDetalle)."],
                    ['titulo' => "3. ¿Cómo subir tu rendimiento?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Corrige primero $principalNombre ya que es lo que más te resta. Después optimiza los otros factores para ganar toneladas adicionales."],
                    ['titulo' => "4. Valor económico de tu cosecha", 'tipo' => 'info',
                     'contenido' => "Con $rendPredichoVal t/ha en $areaHa ha, tu producción total sería de **" . round($rendPredichoVal * $areaHa, 1) . " toneladas** (" . round($rendPredichoVal * $areaHa * 22, 0) . " quintales), con un ingreso bruto estimado de **" . round($rendPredichoVal * $areaHa * 22 * 16.50, 2) . " USD** a $16.50 USD/qq."]
                ];
            }
            // --- PROBABILIDAD DE COSECHA ---
            elseif (strpos($nombreLower, 'probabilidad') !== false && (strpos($nombreLower, 'cosecha') !== false || strpos($nombreLower, 'éxito') !== false || strpos($nombreLower, 'exito') !== false)) {
                $porciento = preg_replace('/[^0-9.]/', '', $valor);
                $secciones = [
                    ['titulo' => "1. ¿Qué significa una Probabilidad de Cosecha del $valor?", 'tipo' => 'info',
                     'contenido' => "Hay un **$valor** de certeza estadística de que tu cultivo $variedadMaiz alcanzará las **$rendPredichoVal t/ha** estimadas sin sufrir un colapso por sequía, plagas o heladas durante el ciclo."],
                    ['titulo' => "2. ¿Es buena esta probabilidad?", 'tipo' => floatval($porciento) >= 80 ? 'success' : 'warning',
                     'contenido' => floatval($porciento) >= 80
                        ? "Sí. Una confianza por encima del 80% indica que las condiciones de $ubicacion son estables y tu plan de manejo es sólido."
                        : "Es baja. Factores como lluvias irregulares o temperaturas extremas en $ubicacion aumentan la incertidumbre. Se recomienda un plan de contingencia."],
                    ['titulo' => "3. ¿Cómo mantener alta esta probabilidad?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Mantén el monitoreo de plagas, asegura riegos oportunos y evita sembrar fuera de la ventana óptima para $ubicacion."]
                ];
            }
            // --- INDICE DE COSECHA (HI) ---
            elseif (strpos($nombreLower, 'índice de cosecha') !== false || strpos($nombreLower, 'indice de cosecha') !== false || strpos($nombreLower, 'harvest') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué es el Índice de Cosecha de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "El Índice de Cosecha (HI) de **$valorConUnidad** indica que el **" . round(floatval(str_replace([' HI', ' '], '', $valor)) * 100, 0) . "%** de toda la biomasa que produce tu planta se convierte en grano de maíz. El resto son tallos, hojas y raíces."],
                    ['titulo' => "2. ¿Tu planta es eficiente convirtiendo biomasa en grano?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Un HI entre 0.45 y 0.52 es óptimo. Tu valor de $valorConUnidad " . (floatval(str_replace([' HI', ' '], '', $valor)) >= 0.45 ? "es bueno, la planta está convirtiendo biomasa eficientemente." : "está por debajo, la planta gasta más energía en tallos y hojas que en grano.")],
                    ['titulo' => "3. ¿Cómo mejorar esta conversión?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Asegura suficiente nitrógeno durante el llenado de grano (etapa R3-R5) para que las hojas mantengan la fotosíntesis activa el mayor tiempo posible."]
                ];
            }
            // --- YIELD GAP / BRECHA ---
            elseif (strpos($nombreLower, 'gap') !== false || strpos($nombreLower, 'brecha') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánto rendimiento estás perdiendo?", 'tipo' => 'danger',
                     'contenido' => "La brecha de **$valorConUnidad** es la diferencia entre lo que tu semilla puede producir ($potencialMax t/ha) y lo que realmente vas a cosechar ($rendPredichoVal t/ha). Son toneladas que se pierden por limitaciones del campo."],
                    ['titulo' => "2. ¿Cuál es la causa principal de esta pérdida?", 'tipo' => 'warning',
                     'contenido' => "El factor que más contribuye a la brecha es **$principalNombre**: $principalDetalle. Corregir solo este factor podría recuperar hasta **$principalPerdida t/ha**."],
                    ['titulo' => "3. ¿Vale la pena invertir en cerrar esta brecha?", 'tipo' => 'success',
                     'contenido' => "Sí. Recuperar $principalPerdida t/ha equivale a **+$perdidaDolaresHa USD por hectárea** adicionales en ingresos. En tus $areaHa ha, eso sería **+" . round($perdidaDolaresHa * $areaHa, 2) . " USD** más."]
                ];
            }
            // --- PERDIDA POR AGUA / ESTRES HIDRICO ---
            elseif (strpos($nombreLower, 'pérdida') !== false && (strpos($nombreLower, 'agua') !== false || strpos($nombreLower, 'hídric') !== false || strpos($nombreLower, 'hidric') !== false)) {
                $secciones = [
                    ['titulo' => "1. ¿Por qué pierdes $valorConUnidad por falta de agua?", 'tipo' => 'danger',
                     'contenido' => "Tu lote en $ubicacion recibe **$precipitacionVal mm/año** de lluvia, cuando el maíz necesita al menos 750 mm bien distribuidos. Esta diferencia causa que las mazorcas no llenen todos los granos."],
                    ['titulo' => "2. ¿En qué momento del cultivo más afecta la sequía?", 'tipo' => 'warning',
                     'contenido' => "La falta de agua es más dañina entre la etapa V8 (8 hojas) y R1 (polinización). Durante esos 15-20 días, si el suelo se seca, los estigmas (sedas) no logran capturar el polen y la mazorca queda vacía."],
                    ['titulo' => "3. ¿Cómo evitar esta pérdida?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aplica 2 riegos de auxilio de 25-30 mm durante la emergencia de la espiga y el llenado de grano para recuperar hasta " . abs($lossWater) . " t/ha."]
                ];
            }
            // --- PERDIDA POR NITROGENO ---
            elseif (strpos($nombreLower, 'pérdida') !== false && strpos($nombreLower, 'nitrógeno') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Por qué pierdes $valorConUnidad por falta de Nitrógeno?", 'tipo' => 'danger',
                     'contenido' => "Estás aplicando **$fertilizanteVal kg/ha** de Nitrógeno cuando tu variedad $variedadMaiz necesita al menos **180 kg/ha** para alcanzar su potencial. Esos " . round(180 - $fertilizanteVal, 0) . " kg/ha que faltan se traducen directamente en granos más pequeños y mazorcas incompletas."],
                    ['titulo' => "2. ¿En qué se nota la falta de Nitrógeno?", 'tipo' => 'warning',
                     'contenido' => "Las hojas inferiores se ponen amarillas formando una 'V' desde la punta. Las plantas crecen más bajas y las mazorcas pesan menos porque no tienen suficiente nutriente para llenar todos los granos."],
                    ['titulo' => "3. ¿Cómo corregir el déficit?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Sube la dosis total a 180 kg/ha dividida en 3 aplicaciones: 60 kg/ha en siembra, 60 kg/ha en V4 (aporque) y 60 kg/ha en V8 (pre-floración)."]
                ];
            }
            // --- LIMITANTE PRINCIPAL ---
            elseif (strpos($nombreLower, 'limitante') !== false || strpos($nombreLower, 'cuello') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuál es el principal cuello de botella?", 'tipo' => 'danger',
                     'contenido' => "El factor que más está limitando tu rendimiento en $nombreParcela es **$principalNombre**: $principalDetalle. Te resta **-$principalPerdida t/ha**."],
                    ['titulo' => "2. ¿Por qué este factor es el más importante?", 'tipo' => 'warning',
                     'contenido' => "Mientras no corrijas $principalNombre, invertir en otros insumos tendrá muy poco impacto. Es como regar una planta que necesita sol: el agua sobra si falta lo esencial."],
                    ['titulo' => "3. ¿Cuánto dinero recuperas al corregirlo?", 'tipo' => 'success',
                     'contenido' => "Corregir $principalNombre puede recuperar hasta **$principalPerdida t/ha**, equivalente a **+$perdidaDolaresHa USD/ha** adicionales (+" . round($perdidaDolaresHa * $areaHa, 2) . " USD en tus $areaHa ha)."]
                ];
            }
            // --- ACCION PRIORITARIA / CORRECTORA ---
            elseif (strpos($nombreLower, 'acción') !== false || strpos($nombreLower, 'accion') !== false || strpos($nombreLower, 'prioritaria') !== false || strpos($nombreLower, 'correctora') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuál es la acción más urgente en tu lote?", 'tipo' => 'warning',
                     'contenido' => "La práctica de **$valor** es la que más impacto tendría en tu rendimiento ahora mismo. Aplicarla a tiempo puede marcar la diferencia entre una cosecha rentable y una que no cubre los costos."],
                    ['titulo' => "2. ¿Cuánto rendimiento puedes recuperar?", 'tipo' => 'success',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Aplicar esta corrección a tiempo puede recuperar entre 1.0 y 2.0 t/ha adicionales, dependiendo de cuándo se ejecute en relación a la etapa fenológica del cultivo."],
                    ['titulo' => "3. ¿Cuándo es la fecha límite?", 'tipo' => 'danger',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "La ventana de oportunidad se cierra cuando la planta pasa de la floración (R1). Después de ese momento, el impacto se reduce drásticamente."]
                ];
            }
            // --- FASE FENOLOGICA VULNERABLE ---
            elseif (strpos($nombreLower, 'fase') !== false || strpos($nombreLower, 'fenológ') !== false || strpos($nombreLower, 'fenolog') !== false || strpos($nombreLower, 'floración') !== false || strpos($nombreLower, 'floracion') !== false || strpos($nombreLower, 'emergencia') !== false || strpos($nombreLower, 'crecimiento') !== false || strpos($nombreLower, 'vegetativo') !== false || strpos($nombreLower, 'espigado') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué sucede en la etapa \"$nombre\"?", 'tipo' => 'info',
                     'contenido' => !empty($descripcionTecnica) ? $descripcionTecnica : "En esta fase del ciclo del maíz, la planta es especialmente sensible a cambios bruscos de temperatura y disponibilidad de agua."],
                    ['titulo' => "2. ¿Cuál es el riesgo principal en esta fase?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Si las condiciones no son las adecuadas durante esta etapa, el daño al rendimiento es irreversible porque la planta no puede compensarlo después."],
                    ['titulo' => "3. ¿Qué debes hacer ahora en campo?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Revisa la humedad del suelo y la presencia de plagas. Aplica los insumos que correspondan a esta etapa antes de que la planta avance al siguiente estadio."]
                ];
            }
            // ====== TARJETAS FINANCIERAS ======
            // --- ROI / RETORNO DE INVERSION ---
            elseif (strpos($nombreLower, 'roi') !== false || strpos($nombreLower, 'retorno') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué significa un ROI de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "Un Retorno de Inversión de **$valorConUnidad** significa que por cada dólar que inviertes en tu lote $nombreParcela, recuperas ese dólar más **" . round(floatval(str_replace(['%', ' '], '', $valor)) / 100, 2) . " USD** de ganancia. " . (floatval(str_replace(['%', ' '], '', $valor)) > 20 ? "Es una rentabilidad atractiva." : "Es un retorno que podría mejorar.")],
                    ['titulo' => "2. ¿Tu inversión en maíz es rentable?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => $nivelText === 'favorable'
                        ? "Sí. Con un rendimiento de $rendPredichoVal t/ha y el precio actual del maíz, tu inversión genera más ganancia que dejar el dinero en el banco."
                        : "Con el rendimiento actual de $rendPredichoVal t/ha, tu ROI está bajo. Necesitas subir la cosecha o reducir costos para que la siembra sea más rentable."],
                    ['titulo' => "3. ¿Cómo mejorar la rentabilidad?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Reduce costos fraccionando la compra de insumos y negocia el precio de venta anticipadamente para asegurar un ingreso mínimo."]
                ];
            }
            // --- MARGEN NETO / GANANCIA ---
            elseif (strpos($nombreLower, 'margen') !== false || strpos($nombreLower, 'ganancia') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánto dinero te queda limpio?", 'tipo' => 'info',
                     'contenido' => "El Margen Neto de **$valorConUnidad** es lo que te queda después de restar todos los costos (semilla, fertilizante, mano de obra, riego) del ingreso total por la venta del maíz en tu parcela $nombreParcela."],
                    ['titulo' => "2. ¿Este margen cubre tu trabajo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
                     'contenido' => $nivelText === 'favorable'
                        ? "Sí. Con $rendPredichoVal t/ha de cosecha y tus costos actuales, la siembra está generando una utilidad que justifica la inversión de tiempo y recursos."
                        : "Tu margen está ajustado. Con el rendimiento actual de $rendPredichoVal t/ha, cualquier gasto imprevisto o caída de precio podría dejarte sin ganancia."],
                    ['titulo' => "3. ¿Cómo aumentar tu margen?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta tu rendimiento corrigiendo $principalNombre y vende al menos a $16.50 USD/qq para cubrir costos con holgura."]
                ];
            }
            // --- INGRESO BRUTO ---
            elseif (strpos($nombreLower, 'ingreso') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánto dinero genera tu cosecha?", 'tipo' => 'info',
                     'contenido' => "El Ingreso Bruto de **$valorConUnidad** es el total que recibirías al vender toda tu cosecha de $rendPredichoVal t/ha a precio de mercado, sin descontar costos de producción."],
                    ['titulo' => "2. ¿De dónde sale este cálculo?", 'tipo' => 'info',
                     'contenido' => "Se calcula multiplicando tu cosecha estimada ($rendPredichoVal t/ha × $areaHa ha = " . round($rendPredichoVal * $areaHa, 1) . " toneladas) por el precio del quintal de maíz ($16.50 USD/qq, con 22 quintales por tonelada)."],
                    ['titulo' => "3. ¿Cómo maximizar tu ingreso?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta el rendimiento por hectárea y vende en el momento del año cuando el precio del quintal esté más alto (usualmente entre mayo y julio)."]
                ];
            }
            // --- COSTO TOTAL / INSUMOS ---
            elseif (strpos($nombreLower, 'costo') !== false || strpos($nombreLower, 'insumos') !== false || strpos($nombreLower, 'costos fijos') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánto te cuesta producir tu maíz?", 'tipo' => 'info',
                     'contenido' => "El Costo Total de **$valorConUnidad** incluye todo lo que gastas para producir maíz en $nombreParcela: semilla, fertilizante ($fertilizanteVal kg/ha), preparación del terreno, riego y mano de obra."],
                    ['titulo' => "2. ¿Tus costos son razonables?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Para la zona de $ubicacion, un costo de producción aceptable está entre $500 y $700 USD/ha. " . ($nivelText === 'favorable' ? "Tus costos están dentro del rango." : "Revisa si hay rubros que puedas optimizar sin perder rendimiento.")],
                    ['titulo' => "3. ¿Dónde puedes reducir costos?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Compra fertilizante al inicio de temporada cuando los precios son más bajos y fracciona la aplicación para reducir desperdicio por lixiviación."]
                ];
            }
            // --- B/C (BENEFICIO/COSTO) ---
            elseif (strpos($nombreLower, 'beneficio') !== false || strpos($nombreLower, 'b/c') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué significa una Relación B/C de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "Una relación Beneficio/Costo de **$valorConUnidad** indica que por cada dólar invertido en tu cultivo, generas **$valor** dólares en retorno. " . (floatval(str_replace([' ', '$'], '', $valor)) > 1.0 ? "Como es mayor a 1.0, tu proyecto es rentable." : "Si es menor a 1.0, estás perdiendo dinero.")],
                    ['titulo' => "2. ¿Es competitivo para la zona?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "En la agricultura de $ubicacion, una relación B/C mayor a 1.3 se considera buena y mayor a 1.5 es excelente."],
                    ['titulo' => "3. ¿Cómo mejorar la relación B/C?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Sube el rendimiento corrigiendo tu limitante principal ($principalNombre) y negocia precios de venta anticipados para asegurar ingresos."]
                ];
            }
            // --- PUNTO DE EQUILIBRIO ---
            elseif (strpos($nombreLower, 'equilibrio') !== false || strpos($nombreLower, 'break') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánto necesitas cosechar como mínimo?", 'tipo' => 'info',
                     'contenido' => "El Punto de Equilibrio de **$valorConUnidad** es el rendimiento mínimo que necesitas para cubrir todos tus costos de producción. Si cosechas menos que esto, pierdes dinero."],
                    ['titulo' => "2. ¿Estás por encima del equilibrio?", 'tipo' => $rendPredichoVal > floatval(str_replace([' t/ha', ' '], '', $valor)) ? 'success' : 'danger',
                     'contenido' => $rendPredichoVal > floatval(str_replace([' t/ha', ' '], '', $valor))
                        ? "Sí. Tu rendimiento estimado de **$rendPredichoVal t/ha** supera el punto de equilibrio, lo que indica que generarás ganancia neta."
                        : "No. Tu rendimiento estimado de **$rendPredichoVal t/ha** está por debajo o muy cerca del equilibrio. Necesitas subir la producción o reducir costos para no tener pérdidas."],
                    ['titulo' => "3. ¿Cómo asegurar que siempre estés por encima?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Reduce el punto de equilibrio bajando costos fijos y variables, y simultáneamente sube el rendimiento corrigiendo $principalNombre."]
                ];
            }
            // --- PRECIO MINIMO DE VENTA ---
            elseif (strpos($nombreLower, 'precio') !== false && (strpos($nombreLower, 'mínimo') !== false || strpos($nombreLower, 'minimo') !== false || strpos($nombreLower, 'piso') !== false)) {
                $secciones = [
                    ['titulo' => "1. ¿A cuánto mínimo debes vender tu maíz?", 'tipo' => 'info',
                     'contenido' => "Para cubrir todos los costos de producción de tu parcela $nombreParcela, necesitas vender cada quintal a un precio mínimo de **$valorConUnidad**. Si vendes por debajo de este precio, pierdes dinero."],
                    ['titulo' => "2. ¿El precio de mercado actual cubre tu piso?", 'tipo' => floatval(str_replace(['USD/qq', ' ', '$'], '', $valor)) <= 16.50 ? 'success' : 'danger',
                     'contenido' => floatval(str_replace(['USD/qq', ' ', '$'], '', $valor)) <= 16.50
                        ? "Sí. El precio de referencia de $16.50 USD/qq está por encima de tu precio piso, así que deberías obtener ganancia."
                        : "Cuidado. Tu precio piso es alto y el mercado podría no cubrirlo. Necesitas reducir costos o aumentar el rendimiento para bajar tu precio de sustentación."],
                    ['titulo' => "3. Estrategia de venta recomendada", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Negocia contratos de compra anticipada con un precio mínimo garantizado y almacena parte de la cosecha para vender cuando el precio suba."]
                ];
            }
            // --- MARGEN DE SEGURIDAD ---
            elseif (strpos($nombreLower, 'seguridad') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué es el Margen de Seguridad de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "El Margen de Seguridad indica cuántas toneladas por hectárea tienes de colchón entre tu rendimiento estimado ($rendPredichoVal t/ha) y el punto de equilibrio. Un margen de **$valorConUnidad** significa que puedes absorber esa pérdida sin entrar en números rojos."],
                    ['titulo' => "2. ¿Es suficiente para absorber imprevistos?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => $nivelText === 'favorable' ? "Sí, tienes un colchón razonable para enfrentar variaciones climáticas o de precio." : "Tu colchón es delgado. Cualquier baja de precio o caída de cosecha por clima podría hacerte perder dinero."],
                    ['titulo' => "3. ¿Cómo ampliar tu margen de seguridad?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta tu rendimiento y baja costos para tener un colchón más amplio entre tu producción y el equilibrio."]
                ];
            }
            // --- CONFIANZA MONTE CARLO / NIVEL DE CONFIANZA ---
            elseif (strpos($nombreLower, 'confianza') !== false || strpos($nombreLower, 'monte carlo') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué indica un Nivel de Confianza del $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "El simulador corrió miles de escenarios combinando diferentes condiciones de clima y precios. En el **$valorConUnidad** de esos escenarios, tu cultivo logra al menos el rendimiento estimado. Es la probabilidad de que tu inversión salga bien."],
                    ['titulo' => "2. ¿Puedes confiar en este número?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : ($nivelText === 'favorable' ? "Sí. Un nivel alto significa que la mayoría de escenarios posibles son favorables para tu cultivo." : "El nivel sugiere que hay bastantes escenarios donde podrías tener pérdidas. Revisa tus variables de entrada.")],
                    ['titulo' => "3. ¿Cómo mejorar la confianza?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Reduce la variabilidad de tus condiciones: asegura riego, usa semilla certificada y corrige la nutrición para tener resultados más predecibles."]
                ];
            }
            // --- RIESGO FINANCIERO / AGRONOMICO ---
            elseif (strpos($nombreLower, 'riesgo') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué tan alto es tu riesgo con $valorConUnidad?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
                     'contenido' => "Un nivel de riesgo de **$valorConUnidad** " . ($nivelText === 'favorable' ? "es bajo, lo que indica que las condiciones actuales son estables para tu cultivo en $ubicacion." : "es preocupante. Indica que hay una probabilidad significativa de que tu cosecha no cubra la inversión en $nombreParcela.")],
                    ['titulo' => "2. ¿Qué factores elevan tu riesgo?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Los factores que más influyen en el riesgo son: variabilidad de lluvias ($precipitacionVal mm), temperatura ($temperaturaVal °C) y el precio de venta del quintal de maíz."],
                    ['titulo' => "3. ¿Cómo reducir el riesgo?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Diversifica con diferentes fechas de siembra, asegura contratos de precio fijo y mantén un fondo de contingencia para imprevistos."]
                ];
            }
            // --- PERFILES FINANCIEROS ---
            elseif (strpos($nombreLower, 'perfiles') !== false || strpos($nombreLower, 'modelos de producción') !== false || strpos($nombreLower, 'modelos de produccion') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué son los Perfiles Financieros?", 'tipo' => 'info',
                     'contenido' => "Este comparador muestra cómo cambian tus ingresos, costos y ganancia según diferentes niveles de inversión (artesanal, tecnificado, intensivo) para tu parcela $nombreParcela de $areaHa ha."],
                    ['titulo' => "2. ¿Cuál perfil te conviene más?", 'tipo' => 'success',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "El perfil que maximiza tu ganancia neta sin requerir inversión excesiva es el más recomendable. Compara el margen de cada perfil para decidir."],
                    ['titulo' => "3. ¿Cómo pasar al siguiente perfil?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Para subir de perfil productivo, incrementa gradualmente la inversión en fertilizante y riego, y monitorea si el rendimiento adicional justifica el costo extra."]
                ];
            }
            // --- TIR / TASA INTERNA DE RETORNO ---
            elseif (strpos($nombreLower, 'tir') !== false || strpos($nombreLower, 'tasa interna') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué es la TIR de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => "La Tasa Interna de Retorno de **$valorConUnidad** mide la rentabilidad anualizada de tu cultivo. Si es mayor que la tasa de interés bancario (aproximadamente 8-10%), tu dinero rinde más en el maíz que en el banco."],
                    ['titulo' => "2. ¿Tu cultivo es mejor inversión que el banco?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => $nivelText === 'favorable' ? "Sí. Con una TIR de $valorConUnidad, tu inversión en maíz supera las alternativas financieras convencionales." : "Tu TIR es baja. Evalúa si el esfuerzo y riesgo de sembrar justifican la ganancia comparada con otras opciones."],
                    ['titulo' => "3. ¿Cómo mejorar la TIR?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Aumenta el rendimiento por hectárea y reduce costos innecesarios. Cada tonelada adicional que coseches mejora significativamente la TIR."]
                ];
            }
            // --- GANANCIA POR DOLAR ---
            elseif (strpos($nombreLower, 'dólar') !== false || strpos($nombreLower, 'dolar') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánto ganas por cada dólar invertido?", 'tipo' => 'info',
                     'contenido' => "Por cada dólar que inviertes en tu cultivo de maíz en $nombreParcela, obtienes **$valorConUnidad** de retorno. " . (floatval(str_replace(['$', 'USD', ' '], '', $valor)) > 0 ? "Esto incluye tu capital original más la ganancia." : "Este valor indica que no estás recuperando tu inversión.")],
                    ['titulo' => "2. ¿Es competitivo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Una ganancia por dólar superior a $0.20 USD se considera buena en agricultura de maíz para la zona de $ubicacion."],
                    ['titulo' => "3. ¿Cómo mejorar este retorno?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Negocia mejores precios de compra de insumos y optimiza la dosis de fertilizante para obtener más kilos de grano por kg de Nitrógeno aplicado."]
                ];
            }
            // ====== TARJETAS CLIMATICAS ======
            // --- ENSO / EL NIÑO ---
            elseif (strpos($nombreLower, 'enso') !== false || strpos($nombreLower, 'niño') !== false || strpos($nombreLower, 'oscilación') !== false || strpos($nombreLower, 'oscilacion') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué indica el estado ENSO actual?", 'tipo' => 'info',
                     'contenido' => "El fenómeno ENSO (El Niño / La Niña) está actualmente en fase **$valor**. Este fenómeno oceánico-atmosférico cambia los patrones de lluvia y temperatura en toda la costa ecuatoriana y sierra, afectando directamente tu cultivo."],
                    ['titulo' => "2. ¿Cómo afecta a tu maíz en $ubicacion?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "En fase Neutral, las lluvias siguen un patrón normal. En El Niño, hay exceso de lluvias en la costa y sequía en la sierra. En La Niña, ocurre lo contrario."],
                    ['titulo' => "3. ¿Qué precauciones tomar?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Consulta los pronósticos estacionales del INAMHI antes de definir tu fecha de siembra y ajusta la densidad de siembra según la previsión de lluvias."]
                ];
            }
            // --- PROBABILIDAD DE LLUVIA BAJA ---
            elseif (strpos($nombreLower, 'lluvia') !== false && strpos($nombreLower, 'promedio') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué tan probable es que llueva poco?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
                     'contenido' => "Hay un **$valorConUnidad** de probabilidad de que la lluvia en $ubicacion esté por debajo del promedio histórico durante este ciclo de cultivo. " . ($nivelText === 'favorable' ? "Este porcentaje es bajo, lo cual es positivo." : "Este porcentaje es preocupante y requiere un plan de contingencia.")],
                    ['titulo' => "2. ¿Qué le pasa a tu maíz si llueve poco?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Si la lluvia es insuficiente durante la floración (VT-R1), los estigmas del maíz se secan y no capturan el polen. El resultado son mazorcas con pocos granos y pérdida de hasta 2-3 t/ha."],
                    ['titulo' => "3. ¿Cómo prepararte?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Instala un sistema de riego complementario o programa riegos de auxilio de 25-30 mm durante las etapas V8 y VT."]
                ];
            }
            // --- AGUA UTIL INICIAL EN SUELO ---
            elseif (strpos($nombreLower, 'agua') !== false && strpos($nombreLower, 'inicial') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuánta agua tiene tu suelo ahora?", 'tipo' => 'info',
                     'contenido' => "Tu suelo $tipoSuelo en $nombreParcela tiene actualmente **$valorConUnidad** de agua útil disponible para las raíces. Esta reserva es la que las plantas consumirán mientras no llueva."],
                    ['titulo' => "2. ¿Es suficiente para arrancar el cultivo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : ($nivelText === 'favorable' ? "Sí. Tu suelo arranca con buena reserva hídrica para las primeras semanas del cultivo." : "No es ideal. Las primeras semanas son cruciales y la falta de humedad puede afectar la germinación uniformemente.")],
                    ['titulo' => "3. ¿Qué hacer si el suelo está seco?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Riega antes de la siembra para llevar el suelo a capacidad de campo y asegura que las semillas germinen uniformemente."]
                ];
            }
            // --- INDICE DE RIESGO ESTACIONAL ---
            elseif (strpos($nombreLower, 'riesgo estacional') !== false || strpos($nombreLower, 'riesgo compuesto') !== false || strpos($nombreLower, 'riesgo agronómico') !== false || strpos($nombreLower, 'riesgo agronomico') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué mide el Índice de Riesgo de $valorConUnidad?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'danger',
                     'contenido' => "Este índice combina el riesgo de sequía, calor extremo, exceso de lluvia y deficiencia nutricional en un solo número. Un valor de **$valorConUnidad** " . ($nivelText === 'favorable' ? "indica que las condiciones generales son estables para tu cultivo." : "indica que varios factores de riesgo coinciden en esta temporada y debes estar alerta.")],
                    ['titulo' => "2. ¿Qué factores pesan más en el riesgo?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Para tu zona de $ubicacion, los factores de mayor peso son: lluvia ($precipitacionVal mm), temperatura ($temperaturaVal °C) y la fertilización aplicada ($fertilizanteVal kg/ha de N)."],
                    ['titulo' => "3. ¿Cómo bajar el riesgo estacional?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Diversifica las fechas de siembra, asegura riego complementario y mantén reserva de insumos para aplicar fertilización de emergencia si es necesario."]
                ];
            }
            // --- DESVIACION MENSUAL (GRAFICO CLIMA) ---
            elseif (strpos($nombreLower, 'desviación') !== false || strpos($nombreLower, 'desviacion') !== false || strpos($nombreLower, 'anomalía') !== false || strpos($nombreLower, 'anomalia') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué muestra la Desviación Mensual?", 'tipo' => 'info',
                     'contenido' => "Este gráfico compara la lluvia y temperatura de cada mes contra el promedio histórico de $ubicacion. Las barras que se salen del rango normal indican meses atípicos que pueden afectar tu cultivo."],
                    ['titulo' => "2. ¿Hay meses preocupantes?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Los meses con desviaciones grandes durante la floración (VT-R1) son los más riesgosos. Una sequía de 15 días en ese periodo puede costar hasta 2 t/ha de rendimiento."],
                    ['titulo' => "3. ¿Cómo usar esta información?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Planifica tu fecha de siembra para que la floración no coincida con los meses de mayor riesgo climático identificados en este gráfico."]
                ];
            }
            // --- AGUA POR ESTRATO DE SUELO ---
            elseif (strpos($nombreLower, 'estrato') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué muestra el agua por capas del suelo?", 'tipo' => 'info',
                     'contenido' => "Este análisis divide tu suelo en capas (0-20 cm, 20-40 cm, 40-100 cm) y mide cuánta agua tiene cada una. Las raíces del maíz joven usan las capas superficiales, mientras que las raíces profundas acceden a las capas más bajas durante la sequía."],
                    ['titulo' => "2. ¿Por qué importa la distribución por capas?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Si las capas superficiales (0-40 cm) se secan, tu maíz dependerá de las reservas profundas (40-100 cm). Si esas también están vacías, la planta entra en estrés severo."],
                    ['titulo' => "3. ¿Cómo mantener agua en todas las capas?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Incorpora materia orgánica y rastrojos en el suelo para mejorar la infiltración y retención hídrica en todas las profundidades."]
                ];
            }
            // ====== TARJETAS ESCENARIOS ======
            // --- RENDIMIENTO CENTRAL ESPERADO ---
            elseif (strpos($nombreLower, 'central') !== false && strpos($nombreLower, 'esperado') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuál es tu cosecha más probable?", 'tipo' => 'info',
                     'contenido' => "El Rendimiento Central de **$valorConUnidad** es la cosecha más probable según todas las simulaciones de escenarios. No es el mejor ni el peor caso, sino el resultado que ocurre con mayor frecuencia bajo las condiciones actuales."],
                    ['titulo' => "2. ¿Puedes planificar tus finanzas con este dato?", 'tipo' => 'success',
                     'contenido' => "Sí. Usa **$valorConUnidad** como base para calcular tus ingresos y costos. Es el escenario más realista para presupuestar tu campaña en $nombreParcela."],
                    ['titulo' => "3. ¿Cómo mejorar el rendimiento central?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Corrige tu factor limitante principal ($principalNombre) y optimiza la fecha de siembra para elevar el rendimiento central."]
                ];
            }
            // --- PROBABILIDAD DE SUPERAR OBJETIVO ---
            elseif (strpos($nombreLower, 'superar') !== false && (strpos($nombreLower, 'objetivo') !== false || strpos($nombreLower, 'equilibrio') !== false)) {
                $secciones = [
                    ['titulo' => "1. ¿Cuántas chances tienes de lograr tu objetivo?", 'tipo' => 'info',
                     'contenido' => "La probabilidad de **$valorConUnidad** indica las chances de que tu cosecha supere el objetivo mínimo necesario. " . (floatval(str_replace(['%', ' '], '', $valor)) >= 70 ? "Es una probabilidad favorable." : "Está por debajo de lo ideal y conviene tomar medidas para mejorarla.")],
                    ['titulo' => "2. ¿Qué puede hacer que no lo logres?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Los factores que más pueden impedirlo son: sequías inesperadas, caída de precios o ataques de plagas durante la fase reproductiva del maíz."],
                    ['titulo' => "3. ¿Cómo aumentar esta probabilidad?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Diversifica riesgos sembrando en distintas fechas y asegura la nutrición completa del cultivo para no depender solo del clima."]
                ];
            }
            // --- ESTABILIDAD DE RENDIMIENTO ---
            elseif (strpos($nombreLower, 'estabilidad') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué tan estable es tu rendimiento?", 'tipo' => 'info',
                     'contenido' => "La estabilidad de **$valorConUnidad** mide cuánto varía tu rendimiento entre campañas o simulaciones. " . ($nivelText === 'favorable' ? "Un valor alto indica que tus resultados son consistentes y predecibles." : "Un valor bajo indica que tu rendimiento oscila mucho entre buenas y malas campañas.")],
                    ['titulo' => "2. ¿Por qué importa la estabilidad?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Un rendimiento inestable dificulta la planificación financiera. No puedes presupuestar con confianza si un año cosechas 8 t/ha y al siguiente solo 4 t/ha."],
                    ['titulo' => "3. ¿Cómo estabilizar tu cosecha?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Usa riego complementario para no depender solo de la lluvia, aplica fertilización fraccionada y usa semillas certificadas con tolerancia a estrés."]
                ];
            }
            // --- FECHA DE SIEMBRA ---
            elseif (strpos($nombreLower, 'fecha') !== false && strpos($nombreLower, 'siembra') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Cuándo es el mejor momento para sembrar?", 'tipo' => 'info',
                     'contenido' => "La fecha de siembra recomendada es **$valor**. Esta ventana se calcula cruzando los patrones históricos de lluvia y temperatura de $ubicacion con las necesidades fisiológicas de la variedad $variedadMaiz."],
                    ['titulo' => "2. ¿Qué pasa si siembras fuera de la ventana?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Sembrar muy temprano o muy tarde puede hacer que la floración coincida con días de calor extremo o sequía, reduciendo tu cosecha entre 1.5 y 3.0 t/ha."],
                    ['titulo' => "3. ¿Cómo ajustar la fecha según tu zona?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Consulta el calendario agroclimático del INAMHI para tu provincia y confirma que el suelo tenga buena humedad antes de colocar la semilla."]
                ];
            }
            // --- MES ESPECIFICO ---
            elseif (strpos($nombreLower, 'mes de') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué dice el análisis de $nombre?", 'tipo' => 'info',
                     'contenido' => "Este mes " . (strpos($nombreLower, 'recomendado') !== false ? "**sí es recomendado** para sembrar." : "**no es recomendado** para la siembra.") . " La evaluación considera la lluvia esperada, temperatura promedio y riesgo de eventos extremos para $ubicacion."],
                    ['titulo' => "2. ¿Cuáles son las condiciones esperadas?", 'tipo' => strpos($nombreLower, 'recomendado') !== false ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : (strpos($nombreLower, 'recomendado') !== false ? "Las condiciones de lluvia y temperatura son favorables para el establecimiento del cultivo y su posterior floración." : "Las condiciones de este mes podrían exponer la floración a estrés hídrico o térmico, reduciendo el potencial de cosecha.")],
                    ['titulo' => "3. Recomendación", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Compara este mes con las alternativas disponibles en el calendario y elige la ventana que mejor proteja la etapa de floración."]
                ];
            }
            // --- COMPARADOR DE HIBRIDOS ---
            elseif (strpos($nombreLower, 'comparador') !== false || strpos($nombreLower, 'híbridos') !== false || strpos($nombreLower, 'hibridos') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué muestra este comparador?", 'tipo' => 'info',
                     'contenido' => "Compara cómo rinden diferentes combinaciones de fecha de siembra e híbridos de maíz para tu zona de $ubicacion. Te ayuda a elegir la mejor combinación para maximizar la cosecha."],
                    ['titulo' => "2. ¿Cómo interpretar los resultados?", 'tipo' => 'success',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Las celdas de color verde indican combinaciones con alto rendimiento. Las celdas rojas o amarillas indican combinaciones de menor productividad para las condiciones de tu zona."],
                    ['titulo' => "3. ¿Qué combinación elegir?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Elige la combinación con el mayor rendimiento estimado y verifica que el híbrido esté disponible en tu zona. Prioriza las celdas verdes con ventana de siembra de enero a marzo."]
                ];
            }
            // --- ESTRATEGIA ESPECIFICA ---
            elseif (strpos($nombreLower, 'estrategia') !== false) {
                $secciones = [
                    ['titulo' => "1. Análisis de $nombre", 'tipo' => 'info',
                     'contenido' => !empty($descripcionTecnica) ? $descripcionTecnica : "Esta estrategia combina un conjunto específico de insumos, densidad de siembra y manejo agronómico para alcanzar un rendimiento objetivo en tu parcela $nombreParcela."],
                    ['titulo' => "2. ¿Es viable para tu lote?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "La viabilidad depende de tu presupuesto disponible y las condiciones de suelo y clima de $ubicacion. Compara el costo total contra el ingreso esperado."],
                    ['titulo' => "3. Recomendación de implementación", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Si decides implementar esta estrategia, planifica las compras de insumos con anticipación y confirma la disponibilidad de riego antes de comprometer la inversión."]
                ];
            }
            // --- GRAFICO GENERICO (distribucion, comparativo, etc) ---
            elseif (strpos($nombreLower, 'gráfico') !== false || strpos($nombreLower, 'grafico') !== false || strpos($nombreLower, 'distribución') !== false || strpos($nombreLower, 'distribucion') !== false) {
                $secciones = [
                    ['titulo' => "1. ¿Qué muestra \"$nombre\"?", 'tipo' => 'info',
                     'contenido' => !empty($descripcionTecnica) ? $descripcionTecnica : "Este gráfico visualiza los datos de tu simulación para la parcela $nombreParcela, permitiéndote identificar patrones y tendencias en tu cultivo."],
                    ['titulo' => "2. ¿Qué debes observar?", 'tipo' => 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : "Busca los valores extremos (muy altos o muy bajos) y las tendencias. Los puntos fuera del rango normal indican áreas de oportunidad o riesgo que debes atender."],
                    ['titulo' => "3. ¿Cómo usar estos datos?", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Usa esta información para ajustar tu plan de manejo y priorizar los factores que más impactan tu rendimiento y rentabilidad."]
                ];
            }
            // --- DEFAULT: TARJETA NO RECONOCIDA (usa el nombre y los datos de la tarjeta) ---
            else {
                $secciones = [
                    ['titulo' => "1. ¿Qué indica \"$nombre\" con valor de $valorConUnidad?", 'tipo' => 'info',
                     'contenido' => !empty($descripcionTecnica) ? "En tu parcela $nombreParcela: $descripcionTecnica" : "El indicador **$nombre** registra un valor de **$valorConUnidad** para tu parcela $nombreParcela ($areaHa ha) con la variedad $variedadMaiz en $ubicacion." . (!empty($rangoIdeal) ? " El rango ideal para esta métrica es de $rangoIdeal." : "")],
                    ['titulo' => "2. ¿Cómo afecta a tu cultivo?", 'tipo' => $nivelText === 'favorable' ? 'success' : 'warning',
                     'contenido' => !empty($impactoBase) ? $impactoBase : ($nivelText === 'favorable' ? "El valor de **$valorConUnidad** para $nombre es adecuado para las condiciones de $ubicacion y tu variedad $variedadMaiz." : "El valor de **$valorConUnidad** para $nombre podría estar afectando tu rendimiento estimado de $rendPredichoVal t/ha. Tu factor limitante principal es $principalNombre.")],
                    ['titulo' => "3. Recomendación para tu lote", 'tipo' => 'success',
                     'contenido' => !empty($recomendacionBase) ? $recomendacionBase : "Revisa si puedes optimizar $nombre ajustando los insumos o el manejo agronómico de tu parcela $nombreParcela."]
                ];
            }
        }

        // Construir respuesta
        $mappedResponse = [
            'titulo' => $nombre,
            'nivel' => $nivelText,
            'nivel_del_resultado' => $nivelText,
            'secciones' => $secciones,
            'que_significa' => $secciones[0]['contenido'] ?? '',
            'por_que_pudo_pasar' => $secciones[1]['contenido'] ?? '',
            'como_mejorarlo' => $secciones[2]['contenido'] ?? ($secciones[count($secciones)-1]['contenido'] ?? ''),
            'alerta_clave' => $data['alerta_clave'] ?? $data['alerta'] ?? 'Revisar recomendaciones.',
            'source' => 'Intérprete Agrícola ZeaSys',
            'offline' => true
        ];

        echo json_encode($mappedResponse, JSON_UNESCAPED_UNICODE);
    }
}
