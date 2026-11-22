<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Kernel\Errores\ServicioExternoException;
use ZeaSys\Kernel\Errores\ZeaSysException;

final class CuotaChat
{
    /** Contador por cuenta en este servidor. El archivo solo guarda fechas y totales. */
    public static function reservar(int $usuarioId): array
    {
        $ahora = time();
        $dia = gmdate('Y-m-d', $ahora);
        $maxDia = max(1, (int) (getenv('ZEASYS_CHAT_LIMITE_DIARIO') ?: 60));
        $maxMinuto = max(1, (int) (getenv('ZEASYS_CHAT_LIMITE_MINUTO') ?: 8));
        $ruta = sys_get_temp_dir() . '/zeasys-chat-' . hash('sha256', __DIR__ . ':' . $usuarioId);
        $archivo = fopen($ruta, 'c+b');
        if (!$archivo) throw new ServicioExternoException('No se pudo verificar la cuota del asistente.');
        try {
            if (!flock($archivo, LOCK_EX)) throw new ServicioExternoException('No se pudo reservar la consulta.');
            $contenido = stream_get_contents($archivo);
            $estado = $contenido === '' ? [] : json_decode($contenido, true, 16, JSON_THROW_ON_ERROR);
            $total = ($estado['dia'] ?? null) === $dia ? (int) $estado['total'] : 0;
            $recientes = array_values(array_filter($estado['recientes'] ?? [], static fn (int $t): bool => $t > $ahora - 60));
            if ($total >= $maxDia || count($recientes) >= $maxMinuto) {
                $espera = $total >= $maxDia ? 86400 - $ahora % 86400 : max(1, 60 + $recientes[0] - $ahora);
                if (!headers_sent()) header('Retry-After: ' . $espera);
                throw new ZeaSysException($total >= $maxDia ? 'Alcanzaste el límite diario del asistente.' : 'Alcanzaste el límite de consultas por minuto.', 429);
            }
            $recientes[] = $ahora;
            $datos = json_encode(['dia' => $dia, 'total' => ++$total, 'recientes' => $recientes], JSON_THROW_ON_ERROR);
            rewind($archivo);
            if (fwrite($archivo, $datos) !== strlen($datos) || !ftruncate($archivo, strlen($datos)) || !fflush($archivo)) {
                throw new ServicioExternoException('No se pudo actualizar la cuota.');
            }
            return ['fecha_utc' => $dia, 'consultas_hoy' => $total, 'limite_diario' => $maxDia];
        } finally {
            fclose($archivo);
        }
    }
}
