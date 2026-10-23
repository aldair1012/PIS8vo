<?php
// GeminiFlowise.php — cliente del chatflow de Flowise que genera las respuestas.
// El nombre de la clase se conserva por compatibilidad; el proveedor real
// (xAI Grok, Gemini u otro) se configura dentro del chatflow.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Kernel\Errores\ServicioExternoException;

final class GeminiFlowise
{
    /**
     * El chatflow actual usa Conversation Chain y no embeddings, pero el
     * contexto se mantiene acotado para no crecer sin control. El presupuesto
     * conserva clima, precio, impacto, nutrición, rendimiento, finanzas y la
     * última simulación sin enviar historial ni snapshots completos.
     */
    private const MAX_RETRIEVAL_INPUT_CHARS = 4000;
    private const MAX_USER_QUERY_CHARS = 700;
    private const MAX_CONTEXT_CHARS = 3200;

    public function responder(
        string $pregunta,
        array $contexto,
        int $usuarioId,
        ?int $cultivoId,
        ?int $anio,
        ?string $conversationId = null,
        ?string $ambito = null,
    ): string {
        $baseUrl = rtrim((string) FLOWISE_URL, '/');
        $chatflowId = trim((string) FLOWISE_CHATFLOW_ID);
        if ($baseUrl === '' || $chatflowId === '') {
            throw new ServicioExternoException('El flujo de IA no está configurado en Flowise.');
        }
        if (!function_exists('curl_init')) {
            throw new ServicioExternoException('PHP no tiene habilitado cURL para contactar el flujo de IA.');
        }

        $contextoConsulta = $this->compactarContextoParaConsulta($contexto, $pregunta);
        $prompt = $this->construirPrompt($pregunta, $contextoConsulta);
        $scope = implode(':', [
            'zeasys',
            $usuarioId,
            $cultivoId ?? 'sin-parcela',
            $anio ?? 'sin-anio',
            // Los paneles del dashboard comparten la memoria; Nueva Simulación
            // mantiene una sesión aparte para su borrador.
            $ambito ?? 'dashboard',
            $conversationId ?? 'sesion-predeterminada',
        ]);
        $payload = json_encode([
            'question' => $prompt,
            'overrideConfig' => [
                'sessionId' => hash('sha256', $scope),
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($payload)) {
            throw new ServicioExternoException('No se pudo serializar la pregunta para el flujo de IA.');
        }

        $headers = ['Content-Type: application/json'];
        $apiKey = trim((string) FLOWISE_API_KEY);
        if ($apiKey !== '') {
            $headers[] = 'Authorization: Bearer ' . $apiKey;
        }

        $curl = curl_init($baseUrl . '/api/v1/prediction/' . rawurlencode($chatflowId));
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_CONNECTTIMEOUT => 5,
            // La respuesta sale del modelo configurado en Flowise; el límite
            // evita bloquear la interfaz si la cuota o el proveedor no responde.
            CURLOPT_TIMEOUT => FLOWISE_TIMEOUT,
        ]);
        $respuesta = curl_exec($curl);
        $errorCurl = curl_error($curl);
        $estado = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        if (!is_string($respuesta) || $estado < 200 || $estado >= 300) {
            $detalle = $estado > 0 ? "HTTP {$estado}" : 'sin respuesta';
            throw new ServicioExternoException("El flujo de IA no respondió ({$detalle})." . ($errorCurl !== '' ? ' Revisa que Flowise esté iniciado y la credencial del proveedor.' : ''));
        }

        $decodificada = json_decode($respuesta, true);
        $texto = is_array($decodificada)
            ? ($decodificada['text'] ?? $decodificada['answer'] ?? $decodificada['output'] ?? $decodificada['response'] ?? null)
            : null;
        if (!is_string($texto)) {
            throw new ServicioExternoException('El flujo de IA devolvió una respuesta sin texto.');
        }

        $texto = trim($texto);
        if ($texto === '' || $texto === '[object Object]' || mb_strlen($texto, 'UTF-8') < 20) {
            throw new ServicioExternoException('El proveedor de IA devolvió una respuesta vacía o incompleta.');
        }

        return $texto;
    }

    /**
     * Construye la entrada que recibe la Conversation Chain.
     *
     * Se envía completa al modelo; ya no pasa por el embedding de Ollama.
     * Las reglas editoriales viven en el system prompt del nodo Conversation
     * Chain y los datos actuales se limitan a los hechos más útiles.
     */
    private function construirPrompt(string $pregunta, string $contextoJson): string
    {
        $pregunta = $this->limpiarTexto($pregunta, self::MAX_USER_QUERY_CHARS);
        $contextoJson = $this->limpiarTexto($contextoJson, self::MAX_CONTEXT_CHARS);

        $entrada = "Pregunta del usuario: {$pregunta}\n"
            . "Contexto autorizado de ZeaSys: {$contextoJson}\n"
            . 'Reglas: responde sólo lo que se preguntó, sin plantillas ni secciones fijas; no agregues fuentes, '
            . 'fechas, proveedores ni datos de relleno salvo que el usuario los pida; usa sólo las cifras necesarias; '
            . 'respeta unidades: rendimiento_predicho en t/ha, produccion_total_qq y delta_por_qq en qq, '
            . 'margen_neto_por_ha en USD/ha; ante una recomendación amplia prioriza dos o tres factores agronómicos '
            . 'y no enumeres el contexto; no incluyas precio, margen, impacto, fuentes ni cálculos financieros salvo '
            . 'que la pregunta los pida; no inventes cifras ni dosis; distingue clima observado, pronóstico y '
            . 'promedio de los últimos 30 días; '
            . 'en promedio_30d, precipitacion_30d_mm es el acumulado real y precipitacion_anual_estimada_mm es una '
            . 'proyección anual; el precio es referencia oficial, no cotización en vivo; si la pregunta trata de precio, '
            . 'margen o ingreso y existe impacto_precio, usa delta_por_qq y delta_ingreso_estimado; si existe '
            . 'simulacion_borrador, úsalo como fuente principal de la simulación en edición y no lo presentes como '
            . 'resultado ejecutado; simulacion_reciente es un registro anterior, no el resultado del borrador; si '
            . 'existe conversaciones_favoritas, son conversaciones que el usuario guardó: úsalas sólo si la pregunta '
            . 'se refiere a ellas o a lo hablado antes, sin ofrecerlas por iniciativa propia; si '
            . 'falta un dato, dilo sin inventarlo.';

        return $this->limpiarTexto($entrada, self::MAX_RETRIEVAL_INPUT_CHARS);
    }

    /**
     * Conserva la información que el modelo necesita para la respuesta, pero no
     * envía historial, arrays de gráficos ni snapshots completos al prompt.
     * El orden es intencional: los KPI aparecen antes de cualquier dato menos
     * importante y no se pierden al aplicar el límite final.
     */
    private function compactarContextoParaConsulta(array $contexto, string $pregunta): string
    {
        $dashboard = is_array($contexto['dashboard_visible'] ?? null)
            ? $contexto['dashboard_visible']
            : [];
        $agricola = is_array($contexto['contexto_agricola'] ?? null)
            ? $contexto['contexto_agricola']
            : [];

        $dashboardPrioritario = [];
        foreach ([
            'vista',
            'kpis',
            'datos_base_sistema',
            'cultivo_activo',
            'clima_actual',
            'clima_hoy',
            'pronostico_7d',
            'precio_maiz_referencia',
            'api_source',
            'simulaciones_count',
            'kpi_fuentes',
        ] as $clave) {
            if (array_key_exists($clave, $dashboard)) {
                $dashboardPrioritario[$clave] = $this->resumirValor($dashboard[$clave], 700);
            }
        }

        $simulaciones = is_array($contexto['simulaciones_recientes'] ?? null)
            ? $contexto['simulaciones_recientes']
            : [];
        $ultimaSimulacion = is_array($agricola['simulacion_reciente'] ?? null)
            ? $agricola['simulacion_reciente']
            : null;
        if ($ultimaSimulacion === null && isset($simulaciones[0]) && is_array($simulaciones[0])) {
            $ultimaSimulacion = $this->compactarSimulacionParaConsulta($simulaciones[0]);
        }

        $datos = [
            'panel' => $contexto['panel_actual'] ?? null,
            'anio' => $contexto['anio_seleccionado'] ?? null,
            'parcela' => $this->resumirValor($contexto['cultivo_activo'] ?? null, 220),
            // El borrador es la fuente principal cuando el usuario está en
            // Nueva Simulación; se coloca antes de los datos guardados.
            'simulacion_borrador' => is_array($contexto['simulacion_borrador'] ?? null)
                ? $this->compactarBorradorParaConsulta($contexto['simulacion_borrador'])
                : null,
            // El contexto agrícola se arma en el backend y funciona aunque el
            // usuario esté en un panel distinto al de clima o finanzas.
            'precio_maiz' => $this->resumirValor($agricola['precio_maiz'] ?? null, 380),
            'impacto_precio' => $this->resumirValor($agricola['impacto_precio'] ?? null, 420),
            'nutricion' => $this->resumirValor($agricola['nutricion'] ?? null, 460),
            'clima' => $this->resumirValor($agricola['clima'] ?? null, 850),
            'rendimiento' => $this->resumirValor($agricola['rendimiento']['kpis'] ?? null, 360),
            'finanzas' => $this->resumirValor($agricola['finanzas']['kpis'] ?? null, 400),
            'simulacion_reciente' => $this->resumirValor($ultimaSimulacion, 480),
        ];
        if ($datos['simulacion_borrador'] === null) {
            unset($datos['simulacion_borrador']);
        }

        // Las conversaciones guardadas son memoria de largo plazo: sólo se
        // envían cuando la pregunta las menciona para no ofrecerlas sin pedido.
        $favoritos = $this->favoritosParaConsulta($contexto, $pregunta);
        if ($favoritos !== null) {
            $datos['conversaciones_favoritas'] = $favoritos;
        }

        // Si no hay contexto agrícola combinado (por ejemplo, una parcela sin
        // coordenadas o una fuente caída), se conserva el snapshot visible.
        if ($agricola === []) {
            $datos['dashboard'] = $this->resumirValor($dashboardPrioritario, 900);
        }

        // Para preguntas comparativas se agregan dos simulaciones adicionales;
        // la más reciente ya viaja siempre como referencia operativa.
        if (preg_match('/simul|hist[oó]r|compar|rendim|margen|ganancia/i', $pregunta) === 1 && count($simulaciones) > 1) {
            $datos['simulaciones'] = $this->resumirValor(array_map(
                fn (array $simulacion): array => $this->compactarSimulacionParaConsulta($simulacion),
                array_slice($simulaciones, 0, 3),
            ), 480);
            unset($datos['simulacion_reciente']);
        }

        $json = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($json)) {
            return '{}';
        }

        // No se recorta el JSON a ciegas: eso produce una cadena inválida.
        // Si hace falta, se retiran bloques opcionales en orden de prioridad.
        if (mb_strlen($json, 'UTF-8') > self::MAX_CONTEXT_CHARS) {
            foreach (['dashboard', 'simulaciones', 'simulacion_reciente', 'impacto_precio', 'conversaciones_favoritas'] as $claveOpcional) {
                unset($datos[$claveOpcional]);
                $json = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if (!is_string($json)) {
                    return '{}';
                }
                if (mb_strlen($json, 'UTF-8') <= self::MAX_CONTEXT_CHARS) {
                    break;
                }
            }
        }

        return $json;
    }

    /**
     * Envía las conversaciones guardadas sólo cuando la pregunta las menciona.
     * Así el asistente puede recordar contexto previo sin ofrecerlo por
     * iniciativa propia ni ampliar el prompt en preguntas normales.
     *
     * @param array<string, mixed> $contexto
     * @return array<int, array<string, mixed>>|null
     */
    private function favoritosParaConsulta(array $contexto, string $pregunta): ?array
    {
        $favoritos = $contexto['conversaciones_favoritas'] ?? null;
        if (!is_array($favoritos) || $favoritos === []) {
            return null;
        }

        $mencionaGuardadas = preg_match(
            '/favorit|guard(?:é|e|ada|adas|ado|ados)|recuerda|memoria|conversaci(?:ón|ones)? (?:guardada|anterior|previa)|última vez|la vez pasada|hablamos|dijiste/i',
            $pregunta,
        ) === 1;
        if (!$mencionaGuardadas) {
            return null;
        }

        $resumen = $this->resumirValor(array_slice($favoritos, 0, 4), 700);

        return is_array($resumen) ? $resumen : null;
    }

    /**
     * Conserva el borrador completo y en un orden estable. Es el bloque que
     * explica al modelo qué ve el usuario en Nueva Simulación; no debe
     * confundirse con una simulación guardada ni recortarse por presupuesto.
     *
     * @param array<string, mixed> $borrador
     * @return array<string, mixed>
     */
    private function compactarBorradorParaConsulta(array $borrador): array
    {
        $salida = [];
        foreach ([
            'estado',
            'origen',
            'parcela_id',
            'nombre_parcela',
            'area_parcela_ha',
            'area_simulada_ha',
            'temperatura_entrada_c',
            'humedad_entrada_pct',
            'precipitacion_anual_entrada_mm',
            'fertilizante_n_entrada_kg_ha',
            'ph_suelo_entrada',
            'textura_suelo_entrada',
            'campos_faltantes',
            'area_excede_parcela',
            'cargando_ubicacion',
            'nota',
        ] as $clave) {
            if (array_key_exists($clave, $borrador)) {
                $salida[$clave] = $borrador[$clave];
            }
        }
        return $salida;
    }

    /**
     * @param array<string, mixed> $simulacion
     * @return array<string, mixed>
     */
    private function compactarSimulacionParaConsulta(array $simulacion): array
    {
        return [
            'fecha' => $simulacion['fecha'] ?? null,
            'rendimiento_estimado' => $simulacion['rendimiento_estimado'] ?? null,
            'produccion_total' => $simulacion['produccion_total'] ?? null,
            'confianza' => $simulacion['confianza'] ?? null,
            'categoria_cosecha' => $simulacion['categoria_cosecha'] ?? null,
        ];
    }

    /** @return mixed */
    private function resumirValor(mixed $valor, int $presupuesto, int $nivel = 0): mixed
    {
        if ($valor === null || is_bool($valor) || is_int($valor) || is_float($valor)) {
            return $valor;
        }
        if ($nivel >= 3) {
            return is_scalar($valor) ? $this->limpiarTexto((string) $valor, 120) : null;
        }
        if (is_string($valor)) {
            return $this->limpiarTexto($valor, min(180, $presupuesto));
        }
        if (!is_array($valor)) {
            return null;
        }

        $salida = [];
        foreach (array_slice($valor, 0, 18, true) as $clave => $item) {
            $salida[(string) $clave] = $this->resumirValor($item, $presupuesto, $nivel + 1);
            $serializado = json_encode($salida, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (is_string($serializado) && mb_strlen($serializado, 'UTF-8') >= $presupuesto) {
                break;
            }
        }

        return $salida;
    }

    private function limpiarTexto(string $texto, int $limite): string
    {
        $texto = preg_replace('/\s+/u', ' ', trim($texto)) ?? trim($texto);
        if (mb_strlen($texto, 'UTF-8') <= $limite) {
            return $texto;
        }

        return mb_substr($texto, 0, max(0, $limite - 24), 'UTF-8') . ' [recortado]';
    }
}
