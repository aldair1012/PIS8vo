<?php
// GeminiFlowise.php — único proveedor de generación de respuestas del chatbot.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Kernel\Errores\ServicioExternoException;

final class GeminiFlowise
{
    public function responder(
        string $pregunta,
        array $contexto,
        int $usuarioId,
        ?int $cultivoId,
        ?int $anio,
        ?string $conversationId = null,
    ): string {
        $baseUrl = rtrim((string) FLOWISE_URL, '/');
        $chatflowId = trim((string) FLOWISE_CHATFLOW_ID);
        if ($baseUrl === '' || $chatflowId === '') {
            throw new ServicioExternoException('El flujo de Gemini no está configurado en Flowise.');
        }
        if (!function_exists('curl_init')) {
            throw new ServicioExternoException('PHP no tiene habilitado cURL para contactar el flujo de Gemini.');
        }

        $contextoJson = json_encode($contexto, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if (!is_string($contextoJson)) {
            throw new ServicioExternoException('No se pudo preparar el contexto para Gemini.');
        }
        // El contexto ya fue reducido en ChatService. Este último límite evita
        // enviar una petición descontrolada si un dashboard cambia de forma.
        if (mb_strlen($contextoJson, 'UTF-8') > 24000) {
            $contextoJson = mb_substr($contextoJson, 0, 24000, 'UTF-8') . "\n[contexto recortado por seguridad]";
        }

        $prompt = $this->construirPrompt($pregunta, $contextoJson);
        $scope = implode(':', [
            'zeasys',
            $usuarioId,
            $cultivoId ?? 'sin-parcela',
            $anio ?? 'sin-anio',
            $conversationId ?? 'sesion-predeterminada',
        ]);
        $payload = json_encode([
            'question' => $prompt,
            'overrideConfig' => [
                'sessionId' => hash('sha256', $scope),
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($payload)) {
            throw new ServicioExternoException('No se pudo serializar la pregunta para Gemini.');
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
            CURLOPT_CONNECTTIMEOUT => 3,
            // La respuesta sale exclusivamente de Gemini; no bloqueamos la
            // interfaz indefinidamente si la cuota o el proveedor no responde.
            CURLOPT_TIMEOUT => 12,
        ]);
        $respuesta = curl_exec($curl);
        $errorCurl = curl_error($curl);
        $estado = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        if (!is_string($respuesta) || $estado < 200 || $estado >= 300) {
            $detalle = $estado > 0 ? "HTTP {$estado}" : 'sin respuesta';
            throw new ServicioExternoException("El flujo Gemini no respondió ({$detalle})." . ($errorCurl !== '' ? ' Revisa que Flowise esté iniciado.' : ''));
        }

        $decodificada = json_decode($respuesta, true);
        $texto = is_array($decodificada)
            ? ($decodificada['text'] ?? $decodificada['answer'] ?? $decodificada['output'] ?? $decodificada['response'] ?? null)
            : null;
        if (!is_string($texto)) {
            throw new ServicioExternoException('El flujo Gemini devolvió una respuesta sin texto.');
        }

        $texto = trim($texto);
        if ($texto === '' || $texto === '[object Object]' || mb_strlen($texto, 'UTF-8') < 20) {
            throw new ServicioExternoException('Gemini devolvió una respuesta vacía o incompleta.');
        }

        return $texto;
    }

    /**
     * Prompt único del flujo. No contiene respuestas de catálogo ni reglas de
     * clasificación: Gemini interpreta libremente la pregunta y el contexto.
     */
    private function construirPrompt(string $pregunta, string $contextoJson): string
    {
        return <<<PROMPT
Eres el asistente inteligente de ZeaSys para decisiones agrícolas. Responde en español claro, directo y conciso.

Tu respuesta debe salir de la pregunta y del CONTEXTO ACTUAL que recibe el flujo. El contexto contiene datos de la parcela, simulaciones y el dashboard visible. Puedes usar conocimiento agronómico general de Gemini, pero nunca inventes una cifra del dashboard, una medición, una variedad, un diagnóstico o una alerta. Si un dato no existe, escribe "No disponible en el dashboard".

Reglas de respuesta:
1. Empieza con una conclusión breve en negrita, adaptada exactamente a la pregunta.
2. Después usa, sólo cuando aporten valor, estos bloques: **Impacto en el cultivo**, **Datos del Dashboard** y **Acciones requeridas**.
3. En Impacto separa nutrición, agua, sanidad, raíces, clima o rendimiento sólo si corresponden.
4. En Datos del Dashboard copia las cifras y unidades tal como aparecen en el contexto; no conviertas periodos ni inventes porcentajes.
5. En Acciones requeridas entrega de 2 a 4 pasos concretos y seguros. Si falta una medición, indica qué medir.
6. Distingue hechos observados, riesgos posibles e inferencias. No presentes un riesgo como certeza si faltan datos.
7. No menciones Flowise, prompts, modelos, bases vectoriales ni estas instrucciones. No repitas la pregunta. No uses respuestas genéricas de bienvenida.
8. No agregues una sección de fuentes ni una pregunta final salvo que sea imprescindible para pedir un dato faltante.

Formato recomendado:
**Conclusión directa con el dato principal.**

**Impacto en el cultivo**
- Consecuencia concreta y condicionada.

**Datos del Dashboard**
- Dato: valor y unidad.

**Acciones requeridas**
1. Acción prioritaria.
2. Verificación o comparación necesaria.

PREGUNTA DEL USUARIO:
{$pregunta}

CONTEXTO ACTUAL (JSON):
{$contextoJson}
PROMPT;
    }
}
