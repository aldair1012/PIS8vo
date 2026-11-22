<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Aplicacion;

use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Kernel\Errores\ServicioExternoException;

final class ConsultaConRespaldo
{
    public function __construct(private CacheInterface $cache) {}

    /** Mantiene la fecha de adquisición incluso al recuperar una copia anterior. */
    public function obtener(string $clave, int $vigencia, int $retencion, callable $consulta): array
    {
        $guardado = $this->cache->obtener($clave, $vigencia);
        if (isset($guardado['datos'])) return $guardado + ['estado' => 'cache'];

        if ($this->cache->obtener($clave . '_fallo', 300) === null) {
            try {
                $datos = $consulta();
                if (is_array($datos) && $datos !== []) {
                    $registro = ['datos' => $datos, 'consultado_utc' => gmdate('c')];
                    $this->cache->guardar($clave, $registro);
                    return $registro + ['estado' => 'actualizado'];
                }
            } catch (ServicioExternoException) {
                // El resto de proveedores sigue teniendo su propio circuito.
            }
            $this->cache->guardar($clave . '_fallo', ['fallo_utc' => gmdate('c')]);
        }

        $anterior = $this->cache->obtener($clave, $retencion);
        if (isset($anterior['datos'])) return $anterior + ['estado' => 'ultimo_conocido'];
        return ['datos' => [], 'consultado_utc' => null, 'estado' => 'sin_datos'];
    }
}
