<?php
/**
 * Adapter: GestorMotorIa
 * ======================
 * Port verbatim de helpers/IaServerHelper.php (líneas 8–114): mismos timeouts de cURL,
 * mismos mensajes y misma lógica de arranque vía auto_ia_server.bat.
 * Metamorfosis mecánica: los métodos estáticos pasan a ser de instancia (el puerto
 * GestorMotorIaInterface se inyecta por constructor) y las llamadas self:: pasan a $this->.
 * Único ajuste de ruta: el legacy resolvía la raíz del proyecto como
 * __DIR__ . '/../../' desde backend-api/helpers; aquí el archivo vive 4 niveles más
 * profundo, así que se usan 5 '..' (equivalente real de __DIR__.'/../../' del legacy).
 * Usa la global IA_SERVER_URL (src/Config/aplicacion.php, misma fuente que el legacy).
 * Deuda legacy preservada por paridad (ADR pendiente): sin lock de arranque (dos llamadas
 * concurrentes pueden lanzar el .bat dos veces) y poll síncrono de hasta ~60 s en la petición.
 */

declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Infraestructura;

use ZeaSys\Dominios\Simulaciones\Dominio\GestorMotorIaInterface;

final class GestorMotorIa implements GestorMotorIaInterface
{
    public function estaActivo(): bool
    {
        $ch = curl_init(IA_SERVER_URL . '/health');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 3,
            CURLOPT_CONNECTTIMEOUT => 2,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $httpCode === 200 && $response !== false;
    }

    public function detallesSalud(): ?array
    {
        $ch = curl_init(IA_SERVER_URL . '/health');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 3,
            CURLOPT_CONNECTTIMEOUT => 2,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            return null;
        }

        $data = json_decode($response, true);
        return is_array($data) ? $data : null;
    }

    public function iniciar(): bool
    {
        $root = realpath(__DIR__ . '/../../../../../');
        if (!$root) {
            return false;
        }

        if (PHP_OS_FAMILY === 'Windows') {
            $bat = $root . DIRECTORY_SEPARATOR . 'auto_ia_server.bat';
            if (!file_exists($bat)) {
                return false;
            }
            pclose(popen('start /B "" "' . $bat . '"', 'r'));
            return true;
        }

        $mlDir = $root . '/ml-engine';
        $script = $mlDir . '/app.py';
        if (!file_exists($script)) {
            return false;
        }

        pclose(popen(
            'cd ' . escapeshellarg($mlDir) . ' && nohup python3 app.py > /dev/null 2>&1 &',
            'r'
        ));
        return true;
    }

    public function asegurarActivo(int $maxWaitSeconds = 15): array
    {
        if ($this->estaActivo()) {
            return [
                'status'  => 'ok',
                'running' => true,
                'started' => false,
                'message' => 'Motor de simulación activo',
            ];
        }

        if (!$this->iniciar()) {
            return [
                'status'  => 'error',
                'running' => false,
                'started' => false,
                'message' => 'No se pudo iniciar el motor de simulación. Verifique que Python esté instalado.',
            ];
        }

        for ($i = 0; $i < $maxWaitSeconds; $i++) {
            sleep(1);
            if ($this->estaActivo()) {
                return [
                    'status'  => 'ok',
                    'running' => true,
                    'started' => true,
                    'message' => 'Motor de simulación iniciado correctamente',
                ];
            }
        }

        return [
            'status'  => 'error',
            'running' => false,
            'started' => false,
            'message' => 'El motor de simulación no respondió a tiempo.',
        ];
    }

    public function estado(bool $tryStart = false): array
    {
        $running = $this->estaActivo();
        $started = false;

        if (!$running && $tryStart) {
            $result = $this->asegurarActivo();
            $running = $result['running'] ?? false;
            $started = $result['started'] ?? false;
        }

        return [
            'running' => $running,
            'started' => $started,
            'url'     => IA_SERVER_URL,
            'health'  => $running ? $this->detallesSalud() : null,
            'message' => $running ? 'Motor de simulación activo' : 'Motor de simulación inactivo',
        ];
    }
}
