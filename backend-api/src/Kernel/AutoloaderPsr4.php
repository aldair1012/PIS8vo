<?php
// src/Kernel/AutoloaderPsr4.php — Autoloader PSR-4 para el namespace ZeaSys\ (idempotente: doble registro = no-op).
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class AutoloaderPsr4
{
    private static bool $registrado = false;

    public static function registrar(string $dirBase, string $prefijo = 'ZeaSys\\'): void
    {
        if (self::$registrado) {
            return;
        }
        self::$registrado = true;

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
