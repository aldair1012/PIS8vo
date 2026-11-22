<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Kernel\Errores\ServicioExternoException;
use ZeaSys\Kernel\Errores\ZeaSysException;

final class GeminiDirecto
{
    public function __construct(private string $clave, private string $modelo) {}

    public static function configurado(): ?self
    {
        $modo = getenv('ZEASYS_CHAT_PROVEEDOR') ?: 'auto';
        $clave = trim((string) (getenv('ZEASYS_GEMINI_API_KEY') ?: getenv('GEMINI_API_KEY')));
        if ($modo === 'flowise' || ($modo === 'auto' && $clave === '')) return null;
        if (!in_array($modo, ['auto', 'gemini'], true) || $clave === '') {
            throw new ServicioExternoException('Revisa la configuración del proveedor del asistente.');
        }
        return new self($clave, getenv('ZEASYS_GEMINI_MODEL') ?: 'gemini-3.5-flash-lite');
    }

    public function responder(string $pregunta, string $prompt, array $historial, int $usuarioId, bool $simple, ?callable $emitir): array
    {
        // Solo estas definiciones independientes pueden reutilizarse sin contexto ni historial.
        $normalizada = mb_strtolower(trim($pregunta));
        $temaRegion = $this->temaRegional($normalizada);
        $general = $temaRegion !== null || in_array($normalizada, [
            '¿qué diferencia hay entre humedad del aire y del suelo?', '¿qué es el ph del suelo?', '¿qué significa mm de lluvia?',
        ], true);
        $sistema = file_get_contents(__DIR__ . '/instrucciones-gemini.txt');
        if (!$sistema) throw new ServicioExternoException('No se pudieron cargar las instrucciones del asistente.');
        if ($simple) $sistema .= "\nModo simple: responde con palabras cotidianas, hasta tres frases y una acción concreta.";
        $claveCache = hash('sha256', serialize([$usuarioId, $this->modelo, $sistema, $temaRegion ?? $normalizada]));
        $cache = $_SESSION['chat']['consultas_publicas'][$claveCache] ?? null;
        if ($general && is_array($cache) && ($cache['expira'] ?? 0) > time()) {
            return $cache['resultado'] + ['cache' => true];
        }
        $contenido = [];
        foreach ($general ? [] : array_slice($historial, -8) as $turno) {
            if (!is_string($turno['texto'] ?? null) || !in_array($turno['rol'] ?? null, ['asistente', 'usuario'], true)) continue;
            $contenido[] = ['role' => $turno['rol'] === 'asistente' ? 'model' : 'user', 'parts' => [['text' => mb_substr($turno['texto'], 0, 3000)]]];
        }
        $contenido[] = ['role' => 'user', 'parts' => [['text' => $temaRegion ?? ($general ? $pregunta : $prompt)]]];
        $payload = ['contents' => $contenido, 'systemInstruction' => ['parts' => [['text' => $sistema]]],
            'generationConfig' => ['temperature' => 0.25, 'maxOutputTokens' => 3000]];
        if ($temaRegion !== null || (!$general && preg_match('/\b(busca|buscar|investiga|actual|vigente|hoy|noticias|fuentes?|publicaci[oó]n|recientes?)\b/iu', $pregunta))) {
            $payload['tools'] = [['google_search' => (object) []]];
        }
        $cuota = CuotaChat::reservar($usuarioId);
        try {
            $resultado = $this->generar($payload, $emitir);
        } catch (ZeaSysException $error) {
            if ($error->codigoHttp() !== 429 || !isset($payload['tools'])) throw $error;
            unset($payload['tools']);
            $payload['systemInstruction']['parts'][0]['text'] .= "\nLa búsqueda no estuvo disponible. Explica qué necesita verificación y usa únicamente el contexto y el conocimiento general.";
            $resultado = $this->generar($payload, $emitir);
            $resultado['metadatos']['busqueda_no_disponible'] = true;
        }
        if ($general && ($temaRegion === null || !empty($resultado['metadatos']['busqueda_realizada'])) && empty($resultado['metadatos']['busqueda_no_disponible'])) {
            $entradas = $_SESSION['chat']['consultas_publicas'] ?? [];
            $entradas[$claveCache] = ['resultado' => $resultado, 'expira' => time() + 900];
            $_SESSION['chat']['consultas_publicas'] = array_slice($entradas, -8, null, true);
        }
        return $resultado + ['cuota' => $cuota, 'cache' => false];
    }

    /** Garantiza que una respuesta reutilizable por tema/región nunca contenga datos de parcela. */
    private function temaRegional(string $pregunta): ?string
    {
        $regiones = 'ecuador|costa|sierra|litoral|azuay|bolívar|cañar|carchi|chimborazo|cotopaxi|el oro|esmeraldas|galápagos|guayas|imbabura|loja|los ríos|manabí|morona santiago|napo|orellana|pastaza|pichincha|santa elena|santo domingo de los tsáchilas|sucumbíos|tungurahua|zamora chinchipe';
        $patron = '/^¿?(?:(?:busca|consulta|investiga|cuál es el|qué) )?(?:el |las )?(precio|alertas|plagas) (?:actual(?:es)? )?(?:del? )?maíz en (?:la |el )?(' . $regiones . ')(?: hoy)?[.?!]?$/u';
        return preg_match($patron, $pregunta, $partes) ? "Consulta fuentes públicas actuales sobre {$partes[1]} de maíz en {$partes[2]}, Ecuador. Indica fecha y fuente." : null;
    }

    private function generar(array $payload, ?callable $emitir): array
    {
        $flujo = new FlujoGemini();
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($this->modelo) . ':streamGenerateContent?alt=sse';
        $curl = curl_init($url);
        try {
            curl_setopt_array($curl, [
                CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE),
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $this->clave],
                CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 55,
                CURLOPT_WRITEFUNCTION => static function ($curl, string $bytes) use ($flujo, $emitir): int {
                    if (connection_aborted()) return 0;
                    if (curl_getinfo($curl, CURLINFO_HTTP_CODE) === 200) $flujo->recibir($bytes, $emitir);
                    return strlen($bytes);
                },
            ]);
            $ok = curl_exec($curl);
            $estado = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            if ($estado === 429) throw new ZeaSysException('El proveedor alcanzó su cuota de consultas. Inténtalo más tarde.', 429);
            if (!$ok || $estado !== 200) throw new ServicioExternoException('Gemini no pudo completar la consulta.');
            return $flujo->resultado();
        } finally {
            curl_close($curl);
        }
    }
}
