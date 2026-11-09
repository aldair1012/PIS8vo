<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

use ZeaSys\Kernel\Errores\ValidacionException;

/** Versiona la semántica de la clave dentro del VARCHAR(255), sin cambiar el esquema. */
final class Contrasena
{
    private const PREFIJO_EXACTO = 'zeasys-exact-v1$';

    public static function crearHash(string $contrasena): string
    {
        if ($contrasena === '' || strlen($contrasena) > 72 || str_contains($contrasena, "\0")) {
            throw new ValidacionException('La contraseña debe contener entre 1 y 72 bytes y no puede incluir bytes nulos.');
        }
        return self::PREFIJO_EXACTO . password_hash($contrasena, PASSWORD_BCRYPT);
    }

    public static function verificar(string $contrasena, string $hash): bool
    {
        if ($contrasena === '' || str_contains($contrasena, "\0")) {
            return false;
        }
        if (str_starts_with($hash, self::PREFIJO_EXACTO)) {
            // Bcrypt corta a 72 bytes: no permitir que un sufijo extra autentique.
            return strlen($contrasena) <= 72
                && password_verify($contrasena, substr($hash, strlen(self::PREFIJO_EXACTO)));
        }

        // Las cuentas anteriores se crearon después de trim(). Se conservan sus
        // credenciales sin convertir silenciosamente esa clave en una nueva.
        if (strlen($contrasena) <= 72 && password_verify($contrasena, $hash)) {
            return true;
        }
        $legacy = trim($contrasena);
        return $legacy !== '' && $legacy !== $contrasena && strlen($legacy) <= 72
            && password_verify($legacy, $hash);
    }
}
