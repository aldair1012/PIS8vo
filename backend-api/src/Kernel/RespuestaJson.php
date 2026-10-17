<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class RespuestaJson
{
    public static function enviar(array $datos, int $codigo = 200): void
    {
        http_response_code($codigo);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    }
}
