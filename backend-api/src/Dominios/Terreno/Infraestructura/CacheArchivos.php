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
        $this->directorio = $directorio ?? __DIR__ . '/../../../../data/cache';
    }

    public function obtener(string $clave): ?array
    {
        $this->asegurarDirectorio();

        $archivoCache = $this->rutaArchivo($clave);

        if (file_exists($archivoCache) && (time() - filemtime($archivoCache) < 86400)) {
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

        // Paridad: en el legacy (modo coercitivo) json_encode(false) se escribía como ''.
        $json = json_encode($valor);
        @file_put_contents($this->rutaArchivo($clave), $json === false ? '' : $json);
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

        $files = glob($cacheDir . '/precision_data_*.json');
        if (!$files) {
            return;
        }

        $now = time();
        $expiredTime = 24 * 3600; // 24 horas

        foreach ($files as $file) {
            if (is_file($file)) {
                $fileAge = $now - filemtime($file);
                if ($fileAge > $expiredTime) {
                    @unlink($file);
                }
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
