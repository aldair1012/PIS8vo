<?php
declare(strict_types=1);
namespace ZeaSys\Kernel;
use ZeaSys\Kernel\Errores\ConflictoException;
use ZeaSys\Kernel\Errores\NoAutorizadoException;

final class SesionSinBloqueo
{
    /** Ejecuta I/O largo sobre una copia; solo persiste la clave indicada si la sesión sigue vigente. */
    public static function ejecutar(callable $operacion,string $clave): mixed
    {
        if(session_status()!==PHP_SESSION_ACTIVE) return $operacion();
        $id=session_id(); $usuario=$_SESSION['usuario_id']??null;
        $original=serialize($_SESSION[$clave]??null);
        session_write_close();
        // Configurar antes de transmitir SSE. La reapertura no envía cookies ni
        // cabeceras de caché después del primer fragmento.
        ini_set('session.use_cookies', '0');
        ini_set('session.use_strict_mode', '1');
        session_cache_limiter('');
        $resultado=$operacion();
        $cambio=$_SESSION[$clave]??null;
        $_SESSION=[];
        // Una respuesta antigua no debe sustituir la cookie de un login posterior.
        if (!session_start()) throw new NoAutorizadoException('No se pudo reabrir la sesión.');
        try {
            if(session_id()!==$id || ($_SESSION['usuario_id']??null)!==$usuario) throw new NoAutorizadoException('La sesión cambió mientras se preparaba la respuesta.');
            if(serialize($_SESSION[$clave]??null)!==$original) throw new ConflictoException('La conversación cambió mientras se preparaba la respuesta. Vuelve a enviar la pregunta.');
            if($cambio===null) unset($_SESSION[$clave]);
            else $_SESSION[$clave]=$cambio;
            return $resultado;
        } finally { session_write_close(); }
    }
}
