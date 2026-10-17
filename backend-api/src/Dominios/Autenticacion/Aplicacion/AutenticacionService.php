<?php
// src/Dominios/Autenticacion/Aplicacion/AutenticacionService.php — Casos de uso de autenticación.
// Port verbatim del AuthController legacy (e89067d:backend-api/controllers/AuthController.php):
// mismos strings, códigos y payloads; echo+exit → return/return-payload y errores → excepciones tipadas.
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Aplicacion;

use ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\RecursoNoEncontradoException;
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

    public function me(): array
    {
        $usuarioId = $this->sesion->usuarioId();
        if ($usuarioId !== null) {
            $userDb = $this->usuarios->obtenerPorId($usuarioId);
            if ($userDb) {
                return [
                    'authenticated' => true,
                    'user' => $this->respuestaUsuario($userDb)
                ];
            }
        }
        return [
            'authenticated' => false
        ];
    }

    public function login(Peticion $p): array
    {
        $data = $p->cuerpo();

        $correo = trim($data['correo'] ?? '');
        $contrasena = $data['contrasena'] ?? '';

        if (empty($correo) || empty($contrasena)) {
            throw new ValidacionException('Por favor complete todos los campos.');
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            throw new ValidacionException('El formato del correo no es válido.');
        }

        $usuario = $this->usuarios->login($correo, $contrasena);
        $remember = (bool) ($data['remember'] ?? false);

        if ($usuario) {
            $this->sesion->iniciar($usuario);
            $this->sesion->extenderCookie($remember);

            return [
                'success' => true,
                'message' => '¡Bienvenido, ' . $usuario['nombre'] . '!',
                'user' => $this->respuestaUsuario($usuario)
            ];
        }

        throw new NoAutorizadoException('Correo o contraseña incorrectos.');
    }

    public function googleLogin(Peticion $p): array
    {
        $data = $p->cuerpo();

        $idToken = trim($data['id_token'] ?? '');
        $remember = (bool) ($data['remember'] ?? false);

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
            $this->sesion->extenderCookie($remember);

            return [
                'success' => true,
                'message' => '¡Bienvenido, ' . $usuario['nombre'] . '!',
                'user' => $this->respuestaUsuario($usuario, $picture, 1)
            ];
        }

        throw new AccesoDenegadoException('Este usuario está desactivado en el sistema.');
    }

    public function registro(Peticion $p): array
    {
        $data = $p->cuerpo();

        $nombre = trim($data['nombre'] ?? '');
        $correo = trim($data['correo'] ?? '');
        $contrasena = $data['contrasena'] ?? '';
        $confirmar = $data['confirmar_contrasena'] ?? '';

        if (empty($nombre) || empty($correo) || empty($contrasena)) {
            throw new ValidacionException('Todos los campos son obligatorios.');
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            throw new ValidacionException('El formato del correo no es válido.');
        }

        if (strlen($contrasena) < 8) {
            throw new ValidacionException('La contraseña debe tener al menos 8 caracteres.');
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
                'success' => true,
                'message' => '¡Registro exitoso! Bienvenido a AgroPredict.',
                'user' => [
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

    public function logout(): array
    {
        $this->sesion->cerrar();

        return ['success' => true, 'message' => 'Sesión cerrada correctamente.'];
    }

    public function update(Peticion $p): array
    {
        $usuarioId = $this->sesion->usuarioId();
        if ($usuarioId === null) {
            throw new NoAutorizadoException();
        }

        $data = $p->cuerpo();

        $userActual = $this->usuarios->obtenerPorId($usuarioId);
        if (!$userActual) {
            throw new RecursoNoEncontradoException('Usuario no encontrado.');
        }

        $nombre = trim($data['nombre'] ?? $userActual['nombre']);
        $nuevaContrasena = $data['nueva_contrasena'] ?? '';
        $confirmarNueva = $data['confirmar_nueva_contrasena'] ?? '';

        if (empty($nombre)) {
            throw new ValidacionException('El nombre completo es obligatorio.');
        }

        $contrasenaHash = null;
        if (!empty($nuevaContrasena)) {
            if (strlen($nuevaContrasena) < 8) {
                throw new ValidacionException('La nueva contraseña debe tener al menos 8 caracteres.');
            }

            if (!preg_match('/[A-Z]/', $nuevaContrasena) || !preg_match('/[a-z]/', $nuevaContrasena) || !preg_match('/[0-9]/', $nuevaContrasena) || !preg_match('/[^A-Za-z0-9]/', $nuevaContrasena)) {
                throw new ValidacionException('La contraseña debe contener al menos una letra mayúscula, una letra minúscula, un número y un carácter especial.');
            }

            if ($nuevaContrasena !== $confirmarNueva) {
                throw new ValidacionException('Las nuevas contraseñas no coinciden.');
            }

            $contrasenaHash = password_hash($nuevaContrasena, PASSWORD_BCRYPT);
        }

        try {
            $this->usuarios->actualizarUsuario($usuarioId, $nombre, $contrasenaHash);

            $this->sesion->actualizarNombre($nombre);

            $userDb = $this->usuarios->obtenerPorId($usuarioId);

            return [
                'success' => true,
                'message' => '¡Nombre de perfil actualizado correctamente!',
                'user' => $this->respuestaUsuario($userDb)
            ];
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al actualizar datos: ' . $e->getMessage(), 500);
        }
    }

    public function uploadAvatar(array $archivo): array
    {
        $usuarioId = $this->sesion->usuarioId();
        if ($usuarioId === null) {
            throw new NoAutorizadoException();
        }

        // La capa Http extrae $_FILES['foto']; la forma de $archivo la documenta
        // AlmacenAvatarInterface::guardar() (no se duplica aquí).
        $fotoUrl = $this->avatares->guardar($archivo, $usuarioId);
        $this->usuarios->actualizarFotoPerfil($usuarioId, $fotoUrl, 0);

        $userDb = $this->usuarios->obtenerPorId($usuarioId);

        return [
            'success' => true,
            'message' => '¡Foto de perfil actualizada correctamente!',
            'user' => $this->respuestaUsuario($userDb, $fotoUrl, 0)
        ];
    }

    public function deleteAvatar(): array
    {
        $usuarioId = $this->sesion->usuarioId();
        if ($usuarioId === null) {
            throw new NoAutorizadoException();
        }

        // Paridad legacy: NO se borra el archivo físico, solo la referencia en BD.
        $this->usuarios->actualizarFotoPerfil($usuarioId, null, 0);

        $userDb = $this->usuarios->obtenerPorId($usuarioId);

        return [
            'success' => true,
            'message' => '¡Foto de perfil eliminada!',
            'user' => $this->respuestaUsuario($userDb, null, 0)
        ];
    }

    public function syncGoogleAvatar(Peticion $p): array
    {
        $usuarioId = $this->sesion->usuarioId();
        if ($usuarioId === null) {
            throw new NoAutorizadoException();
        }

        $data = $p->cuerpo();

        $fotoUrl = trim($data['foto_url'] ?? '');
        if (!empty($fotoUrl)) {
            $fotoUrl = preg_replace('/=s\d+(-c)?$/i', '=s400', $fotoUrl);
        }

        if (empty($fotoUrl)) {
            throw new ValidacionException('URL de foto de Google es obligatoria.');
        }

        $this->usuarios->actualizarFotoPerfil($usuarioId, $fotoUrl, 1);
        $userDb = $this->usuarios->obtenerPorId($usuarioId);

        return [
            'success' => true,
            'message' => '¡Foto de Google sincronizada correctamente!',
            'user' => $this->respuestaUsuario($userDb, $fotoUrl, 1)
        ];
    }

    public function eliminar(): array
    {
        $usuarioId = $this->sesion->usuarioId();
        if ($usuarioId === null) {
            throw new NoAutorizadoException();
        }

        try {
            $this->usuarios->eliminarUsuario($usuarioId);
            $this->sesion->cerrar();
            return [
                'success' => true,
                'message' => '¡Su cuenta y todos sus datos han sido eliminados permanentemente del sistema!'
            ];
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al eliminar la cuenta: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Payload de usuario de respuesta — fuente única de los campos 'user'.
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
}
