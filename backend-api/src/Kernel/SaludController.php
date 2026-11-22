<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class SaludController
{
    public function consultar(Peticion $peticion): void
    {
        $urls = [
            'Flask' => rtrim(IA_SERVER_URL, '/') . '/health',
            'Chroma' => rtrim(getenv('ZEASYS_CHROMA_URL') ?: 'http://127.0.0.1:8000', '/') . '/api/v1/heartbeat',
            'Ollama' => rtrim(getenv('ZEASYS_OLLAMA_URL') ?: 'http://127.0.0.1:11434', '/') . '/api/tags',
            'Flowise' => rtrim(FLOWISE_URL, '/') . '/api/v1/ping',
        ];
        $grupo = curl_multi_init();
        $consultas = [];
        foreach ($urls as $nombre => $url) {
            $consulta = curl_init($url);
            curl_setopt_array($consulta, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT_MS => 600, CURLOPT_TIMEOUT_MS => 1500]);
            curl_multi_add_handle($grupo, $consulta);
            $consultas[$nombre] = $consulta;
        }
        do {
            $estado = curl_multi_exec($grupo, $pendientes);
            if ($pendientes && $estado === CURLM_OK && curl_multi_select($grupo, 0.15) === -1) usleep(10000);
        } while ($pendientes && $estado === CURLM_OK);

        $servicios = [];
        foreach ($consultas as $nombre => $consulta) {
            $http = curl_getinfo($consulta, CURLINFO_RESPONSE_CODE);
            $contenido = (string) curl_multi_getcontent($consulta);
            $datos = json_decode($contenido, true);
            $valido = match ($nombre) {
                'Flask' => ($datos['status'] ?? '') === 'ok',
                'Chroma' => isset($datos['nanosecond heartbeat']),
                'Ollama' => isset($datos['models']),
                'Flowise' => str_contains(strtolower($contenido), 'pong'),
            };
            $servicios[$nombre] = $http === 200 && $valido ? 'disponible' : 'sin_respuesta_valida';
            curl_multi_remove_handle($grupo, $consulta);
        }
        curl_multi_close($grupo);
        $servicios['Gemini'] = (getenv('ZEASYS_GEMINI_API_KEY') || getenv('GEMINI_API_KEY')) ? 'configurado_sin_probar_generacion' : 'sin_clave_directa';
        header('Cache-Control: no-store');
        RespuestaJson::enviar(['consulta_utc' => gmdate('c'), 'servicios' => $servicios]);
    }
}
