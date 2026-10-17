<?php
// src/Dominios/Chat/Aplicacion/ChatService.php — Orquestador del chatbot: clasifica → explica → redacta → memoria.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Aplicacion;

use ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface;
use ZeaSys\Dominios\Chat\Dominio\RedactorInterface;
use ZeaSys\Dominios\Chat\Dominio\RouterChatInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ResolutorContextoExplicacion;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad;
use ZeaSys\Kernel\Peticion;

final class ChatService
{
    public function __construct(
        private RouterChatInterface $router,
        private RedactorInterface $redactor,
        private MemoriaSesionInterface $memoria,
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones,
        private ResolutorContextoExplicacion $resolutor,
        private ServicioExplicabilidad $explicabilidad,
    ) {
    }

    /**
     * @return array{texto: string, secciones: array, accion: ?string, confianza: float, intencion: string}
     */
    public function preguntar(string $pregunta, ?string $vista = null, int $usuarioId = 0): array
    {
        $clasificacion = $this->router->classificar($pregunta, $vista);
        $intencion = $clasificacion['intencion'];
        $confianza = $clasificacion['confianza'];

        // Si es follow-up con baja confianza, usar el último tema de la memoria
        $esFollowUp = $clasificacion['parametros']['es_followup'] ?? false;
        if ($esFollowUp && $confianza < 0.5) {
            $temas = $this->memoria->temas();
            if (!empty($temas)) {
                $ultimoTema = end($temas);
                if (in_array($ultimoTema, ['indicador', 'ubicacion', 'clima', 'financiero', 'plaga'], true)) {
                    $intencion = $ultimoTema;
                    $confianza = 0.6;
                }
            }
        }

        $memoria = [
            'temas' => $this->memoria->temas(),
            'historial' => $this->memoria->historial(),
            'contexto' => $this->memoria->contexto(),
        ];

        $texto = '';
        $secciones = [];
        $accion = null;

        // Obtener datos en vivo del usuario
        $cultivosUsuario = [];
        $simulacionesRecientes = [];
        if ($usuarioId > 0) {
            try {
                $cultivosUsuario = $this->cultivos->obtenerPorUsuario($usuarioId);
                $simulacionesRecientes = $this->simulaciones->obtenerRecientes($usuarioId, 5, null);
            } catch (\Throwable $e) {
                // No bloquear la respuesta
            }
        }

        // Actualizar contexto en memoria
        if (!empty($cultivosUsuario)) {
            $this->memoria->registrarContexto([
                'cultivos' => $cultivosUsuario,
                'variedad' => $cultivosUsuario[0]['variedad_maiz'] ?? null,
                'zona' => $cultivosUsuario[0]['ubicacion'] ?? null,
            ]);
        }
        if (!empty($simulacionesRecientes)) {
            $this->memoria->registrarContexto([
                'ultima_simulacion' => $simulacionesRecientes[0],
            ]);
        }

        switch ($intencion) {
            case 'indicador':
                $data = $this->construirContextoIndicador($pregunta, $cultivosUsuario, $simulacionesRecientes);
                $explicacion = $this->explicabilidad->explicar($data);
                $secciones = $explicacion['secciones'] ?? [];
                $hashDeterministico = crc32($pregunta . '|' . ($memoria['temas'] ? implode(',', $memoria['temas']) : ''));
$texto = $this->redactor->redactar($secciones, $data, $memoria, $hashDeterministico);
                $accion = $this->inferirAccion($explicacion, $data);
                break;

            case 'ubicacion':
                $texto = $this->responderUbicacion($cultivosUsuario, $memoria);
                break;

            case 'clima':
                $texto = $this->responderClima($cultivosUsuario, $simulacionesRecientes, $memoria);
                break;

            case 'financiero':
                $texto = $this->responderFinanciero($cultivosUsuario, $simulacionesRecientes, $memoria);
                break;

            case 'plaga':
                $texto = $this->responderPlaga($cultivosUsuario, $memoria);
                break;

            default:
                $texto = $this->responderGeneral($memoria);
                break;
        }

        // Registrar en memoria
        $this->memoria->registrar('usuario', $pregunta);
        $this->memoria->registrar('asistente', $texto);
        $this->memoria->registrarTema($intencion);

        return [
            'texto' => $texto,
            'secciones' => $secciones,
            'accion' => $accion,
            'confianza' => $confianza,
            'intencion' => $intencion,
        ];
    }

    private function construirContextoIndicador(string $pregunta, array $cultivos, array $simulaciones): array
    {
        $cultivo = $cultivos[0] ?? [];
        $simulacion = $simulaciones[0] ?? [];

        // Obtener datos históricos reales si hay simulaciones
        $rendimientosHistoricos = [];
        $promedioHistorico = 0;
        $mejorRendimiento = 0;
        $peorRendimiento = 0;
        
        if (!empty($simulaciones)) {
            foreach ($simulaciones as $sim) {
                $r = floatval($sim['rendimiento_estimado'] ?? 0);
                if ($r > 0) {
                    $rendimientosHistoricos[] = $r;
                }
            }
            if (!empty($rendimientosHistoricos)) {
                $promedioHistorico = round(array_sum($rendimientosHistoricos) / count($rendimientosHistoricos), 2);
                $mejorRendimiento = max($rendimientosHistoricos);
                $peorRendimiento = min($rendimientosHistoricos);
            }
        }

        return [
            'cultivo_id' => $cultivo['id'] ?? null,
            'anio' => null,
            'nombre' => $pregunta,
            'valor' => $simulacion['rendimiento_estimado'] ?? '',
            'unidad' => 't/ha',
            'estado' => 'normal',
            'nombre_parcela' => $cultivo['nombre_parcela'] ?? 'tu parcela',
            'variedad_maiz' => $cultivo['variedad_maiz'] ?? 'Pioneer P4039',
            'ubicacion' => $cultivo['ubicacion'] ?? 'tu zona',
            'area_ha' => $cultivo['area'] ?? 1.0,
            'ph_suelo' => $simulacion['ph_suelo'] ?? 6.2,
            'fertilizante' => $simulacion['fertilizante'] ?? 150,
            'temperatura' => $simulacion['temperatura'] ?? 24.5,
            'precipitacion' => $simulacion['precipitacion'] ?? 800,
            'humedad' => $simulacion['humedad'] ?? 70,
            'tipo_suelo' => $simulacion['tipo_suelo'] ?? 'franco',
            'rendimiento_estimado' => $simulacion['rendimiento_estimado'] ?? 7.5,
            'rend_predicho' => $simulacion['rendimiento_estimado'] ?? 7.5,
            'titulo' => $pregunta,
            'descripcion_tecnica' => '',
            'impacto_base' => '',
            'recomendacion_base' => '',
            'rango_ideal' => '',
            // Datos históricos reales
            'rendimientos_historicos' => $rendimientosHistoricos,
            'promedio_historico' => $promedioHistorico,
            'mejor_rendimiento' => $mejorRendimiento,
            'peor_rendimiento' => $peorRendimiento,
            'total_simulaciones' => count($simulaciones),
        ];
    }

    private function responderUbicacion(array $cultivos, array $memoria): string
    {
        if (empty($cultivos)) {
            return "No tienes parcelas registradas aún. Crea una parcela en la vista de **Cultivos** para ver su ubicación y datos geográficos.";
        }
        $c = $cultivos[0];
        $nombre = $c['nombre_parcela'] ?? 'tu parcela';
        $ubic = $c['ubicacion'] ?? 'sin ubicación';
        $lat = $c['latitud'] ?? '';
        $lng = $c['longitud'] ?? '';
        $alt = $c['altitud'] ?? '';
        $area = $c['area'] ?? '';
        $variedad = $c['variedad_maiz'] ?? 'Pioneer P4039';

        $partes = ["📍 **$nombre** — Ubicación: $ubic"];
        if ($lat && $lng) $partes[] = "Coordenadas: lat $lat, lon $lng" . ($alt ? " (altitud: $alt m)" : "");
        if ($area) $partes[] = "Área: $area ha";
        $partes[] = "Variedad: $variedad";
        $partes[] = "\n💡 *Próximo paso:* ve a la vista de Cultivos para ver el mapa interactivo y los datos de clima/suelo de esta zona.";
        return implode("\n", $partes);
    }

    private function responderClima(array $cultivos, array $simulaciones, array $memoria): string
    {
        if (empty($cultivos)) {
            return "No tienes parcelas registradas. Crea una parcela para ver datos climáticos de tu zona.";
        }
        $c = $cultivos[0];
        $nombre = $c['nombre_parcela'] ?? 'tu parcela';
        $sim = $simulaciones[0] ?? [];
        $temp = $sim['temperatura'] ?? 24.5;
        $prec = $sim['precipitacion'] ?? 800;
        $hum = $sim['humedad'] ?? 70;

        $partes = ["🌤️ **Clima en $nombre**"];
        $partes[] = "Temperatura promedio: **$temp °C**";
        $partes[] = "Precipitación: **$prec mm/año**";
        $partes[] = "Humedad: **$hum %**";
        if ($temp > 32) $partes[] = "⚠️ Temperatura elevada — considera riego complementario.";
        if ($prec < 500) $partes[] = "⚠️ Precipitación baja — riego suplementario recomendado.";
        $partes[] = "\n💡 *Próximo paso:* ve al Dashboard Clima para ver anomalías mensuales, agua útil por estrato y ventana de siembra.";
        return implode("\n", $partes);
    }

    private function responderFinanciero(array $cultivos, array $simulaciones, array $memoria): string
    {
        if (empty($cultivos)) {
            return "No tienes parcelas registradas. Crea una parcela y corre una simulación para ver el análisis financiero.";
        }
        $c = $cultivos[0];
        $nombre = $c['nombre_parcela'] ?? 'tu parcela';
        $sim = $simulaciones[0] ?? [];
        $rend = $sim['rendimiento_estimado'] ?? 0;

        $partes = ["💰 **Análisis financiero — $nombre**"];
        if ($rend > 0) {
            $ingreso = round($rend * 22.0462 * 16.50, 2);
            $partes[] = "Rendimiento estimado: **$rend t/ha** → producción total: **" . round($rend * ($c['area'] ?? 1), 1) . " t**";
            $partes[] = "Ingreso bruto estimado: **$ingreso USD** (a \$16.50/qq)";
        } else {
            $partes[] = "Aún no hay simulaciones. Corre una simulación en la vista Simular para ver ingresos y costos.";
        }
        $partes[] = "\n💡 *Próximo paso:* ve al Dashboard Financiero para ajustar costos, ver sensibilidad precio×rendimiento y estrategias de ROI.";
        return implode("\n", $partes);
    }

    private function responderPlaga(array $cultivos, array $memoria): string
    {
        $plagas = [
            'gusano cogollero' => 'Spodoptera frugiperda — aplicar Lambda-cihalotrina 5% a 150 ml/ha en V4-V6. Umbral: >10% plantas con daño.',
            'roya' => 'Puccinia sorghi — aplicar fungicida triazol (Epoxiconazol) a 1 L/ha preventivo en V8. Monitorear cada 5 días.',
            'gusano elotero' => 'Helicoverpa zea — aplicar Bacillus thuringiensis (Bt) a 1 kg/ha en R1-R2. Umbral: >5% mazorcas con daño.',
            'antracnosis' => 'Colletotrichum graminicola — rotación de cultivos + fungicida Estrobilurina en V6. Evitar siembra continua de maíz.',
            'mosca blanca' => 'Bemisia tabaci — aplicar Imidacloprid a 0.5 L/ha + monitoreo con trampas amarillas.',
        ];

        $partes = ["🐛 **Plagas y enfermedades del maíz**"];
        $partes[] = "Plagas comunes en Ecuador con control recomendado:";
        foreach ($plagas as $nombre => $info) {
            $partes[] = "• **" . ucfirst($nombre) . "**: $info";
        }
        $partes[] = "\n💡 *Próximo paso:* ve al Dashboard Clima → sección 'Plagas por etapa' para ver plagas específicas de tu zona y etapa fenológica.";
        return implode("\n", $partes);
    }

    private function responderGeneral(array $memoria): string
    {
        $temas = $memoria['temas'] ?? [];
        if (in_array('indicador', $temas, true)) {
            return "Puedo ayudarte con más detalles sobre el indicador que vimos. También puedo explicarte otros indicadores de los dashboards (Yield, Scenarios, Climate, Financial), o responder sobre tu ubicación, clima, costos o plagas. ¿Qué te gustaría saber?";
        }
        return "Soy el asistente de AgroPredict DSS. Puedo ayudarte con:\n" .
            "• **Indicadores** — pregunta por cualquier métrica de los dashboards\n" .
            "• **Ubicación** — datos de tu parcela y zona\n" .
            "• **Clima** — temperatura, lluvia, humedad, ENSO\n" .
            "• **Financiero** — costos, ingresos, ROI, margen\n" .
            "• **Plagas** — control y recomendaciones\n" .
            "\n💡 Escribe tu pregunta y te respondo con datos de tu parcela.";
    }

    private function inferirAccion(array $explicacion, array $contexto): ?string
    {
        $recomendacion = $contexto['recomendacion_base'] ?? '';
        if (!empty($recomendacion)) return $recomendacion;
        $secciones = $explicacion['secciones'] ?? [];
        foreach ($secciones as $s) {
            if (isset($s['tipo']) && $s['tipo'] === 'success' && !empty($s['contenido'])) {
                return $s['contenido'];
            }
        }
        return null;
    }
}