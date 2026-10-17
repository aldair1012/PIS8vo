<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class AutoloaderPsr4
{
    public static function registrar(string $dirBase, string $prefijo = 'ZeaSys\\'): void
    {
        spl_autoload_register(static function (string $clase) use ($dirBase, $prefijo): void {
            if (strncmp($clase, $prefijo, strlen($prefijo)) !== 0) {
                return;
            }
            $relativa = substr($clase, strlen($prefijo));
            $archivo  = $dirBase . '/' . str_replace('\\', '/', $relativa) . '.php';
            if (is_file($archivo)) {
                require $archivo;
            }
        });
    }
}
