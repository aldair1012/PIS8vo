<?php
// src/Dominios/Autenticacion/Aplicacion/AutenticacionService.php — Casos de uso de autenticación.
// Orquesta los casos de uso de autenticación y perfil.
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Aplicacion;

use ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\Contrasena;
use ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Errores\ZeaSysException;
use ZeaSys\Kernel\Peticion;

final class AutenticacionService
{
    public function __construct(
        private UsuarioRepositoryInterface $usuarios,
        private VerificadorTokenGoogleInterface $google,
        private AlmacenAvatarInterface $avatares,
        private GestorSesionInterface $sesion,
    ) {
    }

    public function yo(): array
    {
        $usuarioId = $this->sesion->usuarioId();
        if ($usuarioId !== null) {
            $userDb = $this->usuarios->obtenerPorId($usuarioId);
            if ($userDb && !empty($userDb['activo'])) {
                return [
                    'autenticado' => true,
                    'usuario' => $this->respuestaUsuario($userDb)
                ];
            }
            $this->sesion->cerrar();
        }
        return [
            'autenticado' => false
        ];
    }

    public function iniciarSesion(Peticion $p): array
    {
        $data = $p->cuerpo();

        $correo = $this->texto($data, 'correo');
        $contrasena = $this->clave($data, 'contrasena');
        $recordar = $this->booleano($data, 'recordar');

        if (empty($correo) || empty($contrasena)) {
            throw new ValidacionException('Por favor complete todos los campos.');
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            throw new ValidacionException('El formato del correo no es válido.');
        }

        $usuario = $this->usuarios->login($correo, $contrasena);

        if ($usuario) {
            $this->sesion->iniciar($usuario);
            $this->sesion->extenderCookie($recordar);

            return [
                'exito' => true,
                'mensaje' => '¡Bienvenido, ' . $usuario['nombre'] . '!',
                'usuario' => $this->respuestaUsuario($usuario)
            ];
        }

        throw new NoAutorizadoException('Correo o contraseña incorrectos.');
    }

    public function iniciarSesionGoogle(Peticion $p): array
    {
        $data = $p->cuerpo();

        $idToken = $this->texto($data, 'id_token');
        $recordar = $this->booleano($data, 'recordar');

        if (empty($idToken)) {
            throw new ValidacionException('El token de Google es obligatorio.');
        }

        $datosGoogle = $this->google->verificar($idToken);
        $nombre  = $datosGoogle['nombre'];
        $email   = $datosGoogle['correo'];
        $picture = $datosGoogle['picture'];

        $usuario = $this->usuarios->buscarOCrearPorGoogle($nombre, $email, $picture);

        if ($usuario) {
            $this->sesion->iniciar($usuario);
            $this->sesion->extenderCookie($recordar);

            return [
                'exito' => true,
                'mensaje' => '¡Bienvenido, ' . $usuario['nombre'] . '!',
                'usuario' => $this->respuestaUsuario($usuario, $picture, 1)
            ];
        }

        throw new AccesoDenegadoException('Este usuario está desactivado en el sistema.');
    }

    public function registrarse(Peticion $p): array
    {
        $data = $p->cuerpo();

        $nombre = $this->texto($data, 'nombre');
        $correo = $this->texto($data, 'correo');
        $contrasena = $this->clave($data, 'contrasena');
        $confirmar = $this->clave($data, 'confirmar_contrasena');

        if (empty($nombre) || empty($correo) || empty($contrasena)) {
            throw new ValidacionException('Todos los campos son obligatorios.');
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            throw new ValidacionException('El formato del correo no es válido.');
        }

        if (mb_strlen($nombre) > 100 || mb_strlen($correo) > 150) {
            throw new ValidacionException('El nombre o el correo superan la longitud permitida.');
        }

        if (strlen($contrasena) < 8) {
            throw new ValidacionException('La contraseña debe tener al menos 8 caracteres.');
        }

        if (strlen($contrasena) > 72) {
            throw new ValidacionException('La contraseña no puede superar 72 bytes.');
        }

        if (!preg_match('/[A-Z]/', $contrasena) || !preg_match('/[a-z]/', $contrasena) || !preg_match('/[0-9]/', $contrasena) || !preg_match('/[^A-Za-z0-9]/', $contrasena)) {
            throw new ValidacionException('La contraseña debe contener al menos una letra mayúscula, una letra minúscula, un número y un carácter especial.');
        }

        if ($contrasena !== $confirmar) {
            throw new ValidacionException('Las contraseñas no coinciden.');
        }

        if ($this->usuarios->existeCorreo($correo)) {
            throw new ZeaSysException('Este correo ya está registrado.', 409);
        }

        try {
            $id = $this->usuarios->registrar($nombre, $correo, $contrasena);

            $this->sesion->iniciar(['id' => $id, 'nombre' => $nombre, 'correo' => $correo]);

            return [
                'exito' => true,
                'mensaje' => '¡Registro exitoso! Bienvenido a AgroPredict.',
                'usuario' => [
                    'id'          => $id,
                    'nombre'      => $nombre,
                    'correo'      => $correo,
                    'foto_perfil' => null,
                    'es_google'   => 0
                ]
            ];
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al registrar: ' . $e->getMessage(), 500);
        }
    }

    public function cerrarSesion(): array
    {
        $this->sesion->cerrar();

        return ['exito' => true, 'mensaje' => 'Sesión cerrada correctamente.'];
    }

    public function actualizar(Peticion $p): array
    {
        $usuarioActual = $this->usuarioAutenticado();
        $usuarioId = (int) $usuarioActual['id'];
        $data = $p->cuerpo();

        $nombre = array_key_exists('nombre', $data)
            ? $this->texto($data, 'nombre')
            : (string) $usuarioActual['nombre'];
        $nuevaContrasena = $this->clave($data, 'nueva_contrasena');
        $confirmarNueva = $this->clave($data, 'confirmar_nueva_contrasena');

        if (empty($nombre)) {
            throw new ValidacionException('El nombre completo es obligatorio.');
        }

        if (mb_strlen($nombre) > 100) {
            throw new ValidacionException('El nombre no puede superar 100 caracteres.');
        }

        $contrasenaHash = null;
        if ($nuevaContrasena === '' && $confirmarNueva !== '') {
            throw new ValidacionException('Las nuevas contraseñas no coinciden.');
        }
        if ($nuevaContrasena !== '') {
            if (strlen($nuevaContrasena) < 8) {
                throw new ValidacionException('La nueva contraseña debe tener al menos 8 caracteres.');
            }

            if (strlen($nuevaContrasena) > 72) {
                throw new ValidacionException('La nueva contraseña no puede superar 72 bytes.');
            }

            if (!preg_match('/[A-Z]/', $nuevaContrasena) || !preg_match('/[a-z]/', $nuevaContrasena) || !preg_match('/[0-9]/', $nuevaContrasena) || !preg_match('/[^A-Za-z0-9]/', $nuevaContrasena)) {
                throw new ValidacionException('La contraseña debe contener al menos una letra mayúscula, una letra minúscula, un número y un carácter especial.');
            }

            if ($nuevaContrasena !== $confirmarNueva) {
                throw new ValidacionException('Las nuevas contraseñas no coinciden.');
            }

            $contrasenaHash = Contrasena::crearHash($nuevaContrasena);
        }

        try {
            $this->usuarios->actualizarUsuario($usuarioId, $nombre, $contrasenaHash);

            $this->sesion->actualizarNombre($nombre);

            $userDb = $this->usuarios->obtenerPorId($usuarioId);

            return [
                'exito' => true,
                'mensaje' => '¡Nombre de perfil actualizado correctamente!',
                'usuario' => $this->respuestaUsuario($userDb)
            ];
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al actualizar datos: ' . $e->getMessage(), 500);
        }
    }

    public function subirAvatar(array $archivo): array
    {
        $usuarioAnterior = $this->usuarioAutenticado();
        $usuarioId = (int) $usuarioAnterior['id'];

        // La capa Http extrae $_FILES['foto']; la forma de $archivo la documenta
        // AlmacenAvatarInterface::guardar() (no se duplica aquí).
        $fotoUrl = $this->avatares->guardar($archivo, $usuarioId);
        try {
            $this->usuarios->actualizarFotoPerfil($usuarioId, $fotoUrl, 0);
        } catch (\Throwable $e) {
            $this->avatares->eliminar($fotoUrl);
            throw $e;
        }
        $this->avatares->eliminar($usuarioAnterior['foto_perfil'] ?? null);

        $userDb = $this->usuarios->obtenerPorId($usuarioId);

        return [
            'exito' => true,
            'mensaje' => '¡Foto de perfil actualizada correctamente!',
            'usuario' => $this->respuestaUsuario($userDb, $fotoUrl, 0)
        ];
    }

    public function eliminarAvatar(): array
    {
        $usuarioAnterior = $this->usuarioAutenticado();
        $usuarioId = (int) $usuarioAnterior['id'];
        $this->usuarios->actualizarFotoPerfil($usuarioId, null, 0);
        $this->avatares->eliminar($usuarioAnterior['foto_perfil'] ?? null);

        $userDb = $this->usuarios->obtenerPorId($usuarioId);

        return [
            'exito' => true,
            'mensaje' => '¡Foto de perfil eliminada!',
            'usuario' => $this->respuestaUsuario($userDb, null, 0)
        ];
    }

    public function sincronizarAvatarGoogle(Peticion $p): array
    {
        $usuarioAnterior = $this->usuarioAutenticado();
        $usuarioId = (int) $usuarioAnterior['id'];
        $data = $p->cuerpo();

        $fotoUrl = $this->texto($data, 'foto_url');
        if (!empty($fotoUrl)) {
            $fotoUrl = preg_replace('/=s\d+(-c)?$/i', '=s400', $fotoUrl);
        }

        if (empty($fotoUrl)) {
            throw new ValidacionException('URL de foto de Google es obligatoria.');
        }

        $host = strtolower((string) parse_url($fotoUrl, PHP_URL_HOST));
        $scheme = strtolower((string) parse_url($fotoUrl, PHP_URL_SCHEME));
        if ($scheme !== 'https' || ($host !== 'googleusercontent.com' && !str_ends_with($host, '.googleusercontent.com'))) {
            throw new ValidacionException('La URL debe pertenecer a Google y usar HTTPS.');
        }

        $this->usuarios->actualizarFotoPerfil($usuarioId, $fotoUrl, 1);
        $this->avatares->eliminar($usuarioAnterior['foto_perfil'] ?? null);
        $userDb = $this->usuarios->obtenerPorId($usuarioId);

        return [
            'exito' => true,
            'mensaje' => '¡Foto de Google sincronizada correctamente!',
            'usuario' => $this->respuestaUsuario($userDb, $fotoUrl, 1)
        ];
    }

    public function eliminarCuenta(): array
    {
        $usuario = $this->usuarioAutenticado();
        $usuarioId = (int) $usuario['id'];

        try {
            $this->usuarios->eliminarUsuario($usuarioId);
            $this->avatares->eliminar($usuario['foto_perfil'] ?? null);
            $this->sesion->cerrar();
            return [
                'exito' => true,
                'mensaje' => '¡Su cuenta y todos sus datos han sido eliminados permanentemente del sistema!'
            ];
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al eliminar la cuenta: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Payload de usuario de respuesta — fuente única de los campos 'usuario'.
     * @param array<string, mixed> $userDb      Fila con id, nombre, correo, foto_perfil, es_google (PDO: id/es_google nativos int).
     * @param string|null          $fotoFallback Valor si foto_perfil es null (p. ej. picture de Google o la URL recién guardada).
     * @param int|null             $esGoogle    Override explícito de es_google; null → (int) ($userDb['es_google'] ?? 0).
     * @return array{id: int, nombre: string, correo: string, foto_perfil: string|null, es_google: int}
     */
    private function respuestaUsuario(array $userDb, ?string $fotoFallback = null, ?int $esGoogle = null): array
    {
        return [
            'id'          => $userDb['id'],
            'nombre'      => $userDb['nombre'],
            'correo'      => $userDb['correo'],
            'foto_perfil' => $userDb['foto_perfil'] ?? $fotoFallback,
            'es_google'   => $esGoogle ?? (int) ($userDb['es_google'] ?? 0),
        ];
    }

    private function texto(array $data, string $campo): string
    {
        $valor = $data[$campo] ?? '';
        if (!is_string($valor)) {
            throw new ValidacionException("El campo {$campo} debe ser texto.");
        }
        return trim($valor);
    }

    private function clave(array $data, string $campo): string
    {
        $valor = $data[$campo] ?? '';
        if (!is_string($valor) || str_contains($valor, "\0")) {
            throw new ValidacionException("El campo {$campo} debe ser texto sin bytes nulos.");
        }
        return $valor;
    }

    private function booleano(array $data, string $campo): bool
    {
        $valor = $data[$campo] ?? false;
        if (!is_bool($valor)) {
            throw new ValidacionException("El campo {$campo} debe ser booleano.");
        }
        return $valor;
    }

    /** La identidad de cada operación privada siempre procede de la sesión. */
    private function usuarioAutenticado(): array
    {
        $id = $this->sesion->usuarioId();
        $usuario = $id !== null ? $this->usuarios->obtenerPorId($id) : null;
        if (!$usuario || empty($usuario['activo'])) {
            if ($id !== null) $this->sesion->cerrar();
            throw new NoAutorizadoException();
        }
        return $usuario;
    }
}
