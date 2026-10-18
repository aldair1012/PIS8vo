<?php
// src/Kernel/RespuestaJson.php — Respuesta JSON con cabeceras (guard de headers_sent para no reenviar cabeceras).
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class RespuestaJson
{
    public static function enviar(array $datos, int $codigo = 200): void
    {
        $json = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false) {
            $codigo = 500;
            $json = '{"error":"No se pudo generar la respuesta JSON"}';
        }
        if (!headers_sent()) {
            http_response_code($codigo);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo $json;
    }
}
