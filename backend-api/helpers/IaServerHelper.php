<?php
// Clase de ayuda para verificar y levantar el servidor Flask en segundo plano 

require_once __DIR__ . '/../config/database.php';

class IaServerHelper
{
    public static function isRunning(): bool
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

    public static function getHealthDetails(): ?array
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

    public static function start(): bool
    {
        $root = realpath(__DIR__ . '/../../');
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

    public static function ensureRunning(int $maxWaitSeconds = 15): array
    {
        if (self::isRunning()) {
            return [
                'status'  => 'ok',
                'running' => true,
                'started' => false,
                'message' => 'Motor de simulación activo',
            ];
        }

        if (!self::start()) {
            return [
                'status'  => 'error',
                'running' => false,
                'started' => false,
                'message' => 'No se pudo iniciar el motor de simulación. Verifique que Python esté instalado.',
            ];
        }

        for ($i = 0; $i < $maxWaitSeconds; $i++) {
            sleep(1);
            if (self::isRunning()) {
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

    public static function getStatus(bool $tryStart = false): array
    {
        $running = self::isRunning();
        $started = false;

        if (!$running && $tryStart) {
            $result = self::ensureRunning();
            $running = $result['running'] ?? false;
            $started = $result['started'] ?? false;
        }

        return [
            'running' => $running,
            'started' => $started,
            'url'     => IA_SERVER_URL,
            'health'  => $running ? self::getHealthDetails() : null,
            'message' => $running ? 'Motor de simulación activo' : 'Motor de simulación inactivo',
        ];
    }
}
