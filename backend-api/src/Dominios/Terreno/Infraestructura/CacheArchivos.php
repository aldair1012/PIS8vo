<?php
// src/Dominios/Terreno/Infraestructura/CacheArchivos.php — Caché en disco precision_data_*.json (TTL 24 h).
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;

final class CacheArchivos implements CacheInterface
{
    /** @var string backend-api/data/cache (equivalente real de __DIR__.'/../data/cache' del legacy) */
    private string $directorio;

    public function __construct(?string $directorio = null)
    {
        $this->directorio = $directorio ?? (getenv('ZEASYS_CACHE_DIR') ?: __DIR__ . '/../../../../data/cache');
    }

    public function obtener(string $clave, int $ttlSegundos = 86400): ?array
    {
        $this->asegurarDirectorio();

        $archivoCache = $this->rutaArchivo($clave);

        if (file_exists($archivoCache) && (time() - filemtime($archivoCache) < $ttlSegundos)) {
            $contenido = file_get_contents($archivoCache);
            $datosCache = $contenido !== false ? json_decode($contenido, true) : null;
            if ($datosCache) {
                /** @var array<string, mixed> $datosCache */
                return $datosCache;
            }
        }

        return null;
    }

    public function guardar(string $clave, array $valor): void
    {
        $this->asegurarDirectorio();

        $ruta = $this->rutaArchivo($clave);
        $json = json_encode($valor);
        if ($json === false) return;
        $temporal = @tempnam($this->directorio, 'zea_');
        if ($temporal === false) return;
        try {
            if (@file_put_contents($temporal, $json) === strlen($json)) @rename($temporal, $ruta);
        } finally {
            if (is_file($temporal)) @unlink($temporal);
        }
    }

    /**
     * Las claves actuales son precision_data_{float}_{float} (seguras, construidas con round()).
     * Se rechazan claves con separadores o '..' como defensa si un futuro caller pasa datos de
     * la petición (traversal). Inalcanzable con los callers actuales → sin efecto observable.
     */
    private function rutaArchivo(string $clave): string
    {
        if (preg_match('#[/\\\\]|\\.\\.#', $clave) === 1) {
            throw new \InvalidArgumentException("Clave de caché inválida: {$clave}");
        }
        return $this->directorio . '/' . $clave . '.json';
    }

    public function limpiarExpirados(): void
    {
        // Port literal de SimulacionController::limpiarCacheExpirada() (líneas 29–52).
        $cacheDir = $this->directorio;
        if (!is_dir($cacheDir)) {
            return;
        }

        $retenciones = ['precision_data_*' => 1, 'clima_actual_*' => 1, 'archive_*' => 30,
            'soilgrids_*' => 365, 'pronostico_v2_*' => 2, 'dem_glo90_*' => 365, 'gdd_v1_*' => 30];
        $ahora = time();
        foreach ($retenciones as $patron => $dias) {
            foreach (glob($cacheDir . '/' . $patron . '.json') ?: [] as $archivo) {
                $modificado = @filemtime($archivo);
                if ($modificado !== false && $ahora - $modificado > $dias * 86400) @unlink($archivo);
            }
        }
    }

    /** Paridad con el legacy: el directorio se aseguraba al inicio de cada consulta. */
    private function asegurarDirectorio(): void
    {
        if (!is_dir($this->directorio)) {
            @mkdir($this->directorio, 0777, true);
        }
    }
}
