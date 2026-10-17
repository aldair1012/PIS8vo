<?php
// AuthController.php - Maneja el inicio de sesión, registro de nuevos usuarios y cierre de sesión.

require_once __DIR__ . '/../models/Usuario.php';
require_once __DIR__ . '/../config/google.php';

class AuthController
{
    private Usuario $usuario;

    public function __construct()
    {
        $this->usuario = new Usuario();
    }

    public function me(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        if (isset($_SESSION['usuario_id'])) {
            $userDb = $this->usuario->obtenerPorId($_SESSION['usuario_id']);
            if ($userDb) {
                echo json_encode([
                    'authenticated' => true,
                    'user' => [
                        'id'          => $userDb['id'],
                        'nombre'      => $userDb['nombre'],
                        'correo'      => $userDb['correo'],
                        'foto_perfil' => $userDb['foto_perfil'] ?? null,
                        'es_google'   => (int) ($userDb['es_google'] ?? 0)
                    ]
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        echo json_encode([
            'authenticated' => false
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function login(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        $correo = trim($data['correo'] ?? '');
        $contrasena = $data['contrasena'] ?? '';

        if (empty($correo) || empty($contrasena)) {
            http_response_code(400);
            echo json_encode(['error' => 'Por favor complete todos los campos.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'El formato del correo no es válido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $usuario = $this->usuario->login($correo, $contrasena);
        $remember = (bool) ($data['remember'] ?? false);

        if ($usuario) {
            $_SESSION['usuario_id'] = $usuario['id'];
            $_SESSION['nombre']     = $usuario['nombre'];
            $_SESSION['correo']     = $usuario['correo'];

            $sessionName = session_name();
            $sessionId = session_id();
            $params = session_get_cookie_params();
            $lifetime = $remember ? 2592000 : 0;

            setcookie(
                $sessionName,
                $sessionId,
                $lifetime > 0 ? time() + $lifetime : 0,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );

            echo json_encode([
                'success' => true,
                'message' => '¡Bienvenido, ' . $usuario['nombre'] . '!',
                'user' => [
                    'id'          => $usuario['id'],
                    'nombre'      => $usuario['nombre'],
                    'correo'      => $usuario['correo'],
                    'foto_perfil' => $usuario['foto_perfil'] ?? null,
                    'es_google'   => (int) ($usuario['es_google'] ?? 0)
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(401);
        echo json_encode(['error' => 'Correo o contraseña incorrectos.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function googleLogin(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        $idToken = trim($data['id_token'] ?? '');
        $remember = (bool) ($data['remember'] ?? false);

        if (empty($idToken)) {
            http_response_code(400);
            echo json_encode(['error' => 'El token de Google es obligatorio.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($response)) {
            http_response_code(401);
            echo json_encode(['error' => 'El token de Google no es válido o ha expirado.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $payload = json_decode($response, true);
        $email = trim($payload['email'] ?? '');
        $nombre = trim($payload['name'] ?? 'Usuario de Google');
        $picture = trim($payload['picture'] ?? '');
        if (!empty($picture)) {
            $picture = preg_replace('/=s\d+(-c)?$/i', '=s400', $picture);
        }
        $aud = trim($payload['aud'] ?? '');

        if (empty($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'No se pudo obtener el correo del token de Google.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (defined('GOOGLE_CLIENT_ID') && GOOGLE_CLIENT_ID !== '' && $aud !== GOOGLE_CLIENT_ID) {
            http_response_code(401);
            echo json_encode(['error' => 'La audiencia del token de Google no coincide con la aplicación registrada.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $usuario = $this->usuario->buscarOCrearPorGoogle($nombre, $email, $picture);

        if ($usuario) {
            $_SESSION['usuario_id'] = $usuario['id'];
            $_SESSION['nombre']     = $usuario['nombre'];
            $_SESSION['correo']     = $usuario['correo'];

            $sessionName = session_name();
            $sessionId = session_id();
            $params = session_get_cookie_params();
            $lifetime = $remember ? 2592000 : 0;

            setcookie(
                $sessionName,
                $sessionId,
                $lifetime > 0 ? time() + $lifetime : 0,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );

            echo json_encode([
                'success' => true,
                'message' => '¡Bienvenido, ' . $usuario['nombre'] . '!',
                'user' => [
                    'id'          => $usuario['id'],
                    'nombre'      => $usuario['nombre'],
                    'correo'      => $usuario['correo'],
                    'foto_perfil' => $usuario['foto_perfil'] ?? $picture,
                    'es_google'   => 1
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(403);
        echo json_encode(['error' => 'Este usuario está desactivado en el sistema.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function registro(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        $nombre = trim($data['nombre'] ?? '');
        $correo = trim($data['correo'] ?? '');
        $contrasena = $data['contrasena'] ?? '';
        $confirmar = $data['confirmar_contrasena'] ?? '';

        if (empty($nombre) || empty($correo) || empty($contrasena)) {
            http_response_code(400);
            echo json_encode(['error' => 'Todos los campos son obligatorios.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'El formato del correo no es válido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (strlen($contrasena) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'La contraseña debe tener al menos 8 caracteres.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!preg_match('/[A-Z]/', $contrasena) || !preg_match('/[a-z]/', $contrasena) || !preg_match('/[0-9]/', $contrasena) || !preg_match('/[^A-Za-z0-9]/', $contrasena)) {
            http_response_code(400);
            echo json_encode(['error' => 'La contraseña debe contener al menos una letra mayúscula, una letra minúscula, un número y un carácter especial.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($contrasena !== $confirmar) {
            http_response_code(400);
            echo json_encode(['error' => 'Las contraseñas no coinciden.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($this->usuario->existeCorreo($correo)) {
            http_response_code(409);
            echo json_encode(['error' => 'Este correo ya está registrado.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $id = $this->usuario->registrar($nombre, $correo, $contrasena);

            $_SESSION['usuario_id'] = $id;
            $_SESSION['nombre']     = $nombre;
            $_SESSION['correo']     = $correo;

            echo json_encode([
                'success' => true,
                'message' => '¡Registro exitoso! Bienvenido a AgroPredict.',
                'user' => [
                    'id'          => $id,
                    'nombre'      => $nombre,
                    'correo'      => $correo,
                    'foto_perfil' => null,
                    'es_google'   => 0
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al registrar: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function logout(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        session_destroy();
        session_start();
        echo json_encode(['success' => true, 'message' => 'Sesión cerrada correctamente.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function update(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado. Debe iniciar sesión.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $usuarioId = $_SESSION['usuario_id'];
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;

        $userActual = $this->usuario->obtenerPorId($usuarioId);
        if (!$userActual) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $nombre = trim($data['nombre'] ?? $userActual['nombre']);
        $nuevaContrasena = $data['nueva_contrasena'] ?? '';
        $confirmarNueva = $data['confirmar_nueva_contrasena'] ?? '';

        if (empty($nombre)) {
            http_response_code(400);
            echo json_encode(['error' => 'El nombre completo es obligatorio.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $contrasenaHash = null;
        if (!empty($nuevaContrasena)) {
            if (strlen($nuevaContrasena) < 8) {
                http_response_code(400);
                echo json_encode(['error' => 'La nueva contraseña debe tener al menos 8 caracteres.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if (!preg_match('/[A-Z]/', $nuevaContrasena) || !preg_match('/[a-z]/', $nuevaContrasena) || !preg_match('/[0-9]/', $nuevaContrasena) || !preg_match('/[^A-Za-z0-9]/', $nuevaContrasena)) {
                http_response_code(400);
                echo json_encode(['error' => 'La contraseña debe contener al menos una letra mayúscula, una letra minúscula, un número y un carácter especial.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if ($nuevaContrasena !== $confirmarNueva) {
                http_response_code(400);
                echo json_encode(['error' => 'Las nuevas contraseñas no coinciden.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $contrasenaHash = password_hash($nuevaContrasena, PASSWORD_BCRYPT);
        }

        try {
            $this->usuario->actualizarUsuario($usuarioId, $nombre, $contrasenaHash);

            $_SESSION['nombre'] = $nombre;

            $userDb = $this->usuario->obtenerPorId($usuarioId);

            echo json_encode([
                'success' => true,
                'message' => '¡Nombre de perfil actualizado correctamente!',
                'user' => [
                    'id'          => $usuarioId,
                    'nombre'      => $userDb['nombre'],
                    'correo'      => $userDb['correo'],
                    'foto_perfil' => $userDb['foto_perfil'] ?? null,
                    'es_google'   => (int) ($userDb['es_google'] ?? 0)
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al actualizar datos: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function uploadAvatar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado. Debe iniciar sesión.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $usuarioId = $_SESSION['usuario_id'];

        if (!isset($_FILES['foto']) || $_FILES['foto']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No se ha seleccionado ningún archivo o ocurrió un error al subirlo.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $file = $_FILES['foto'];
        $maxSizeBytes = 5 * 1024 * 1024; // 5 MB

        if ($file['size'] > $maxSizeBytes) {
            http_response_code(400);
            echo json_encode(['error' => 'El archivo supera el tamaño máximo permitido de 5 MB.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedMimes, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'El formato del archivo no es permitido. Suba una imagen JPG, PNG, WEBP o GIF.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $extMap = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            'image/gif'  => 'gif'
        ];
        $ext = $extMap[$mimeType] ?? 'jpg';

        $uploadDir = __DIR__ . '/../public/uploads/avatars/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = 'avatar_' . $usuarioId . '_' . time() . '.' . $ext;
        $targetFilePath = $uploadDir . $filename;

        if (move_uploaded_file($file['tmp_name'], $targetFilePath)) {
            $fotoUrl = '/backend-api/public/uploads/avatars/' . $filename;
            $this->usuario->actualizarFotoPerfil($usuarioId, $fotoUrl, 0);

            $userDb = $this->usuario->obtenerPorId($usuarioId);

            echo json_encode([
                'success' => true,
                'message' => '¡Foto de perfil actualizada correctamente!',
                'user' => [
                    'id'          => $usuarioId,
                    'nombre'      => $userDb['nombre'],
                    'correo'      => $userDb['correo'],
                    'foto_perfil' => $fotoUrl,
                    'es_google'   => 0
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(500);
        echo json_encode(['error' => 'No se pudo guardar la imagen en el servidor.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function deleteAvatar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado. Debe iniciar sesión.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $usuarioId = $_SESSION['usuario_id'];
        $this->usuario->actualizarFotoPerfil($usuarioId, null, 0);

        $userDb = $this->usuario->obtenerPorId($usuarioId);

        echo json_encode([
            'success' => true,
            'message' => '¡Foto de perfil eliminada!',
            'user' => [
                'id'          => $usuarioId,
                'nombre'      => $userDb['nombre'],
                'correo'      => $userDb['correo'],
                'foto_perfil' => null,
                'es_google'   => 0
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function syncGoogleAvatar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado. Debe iniciar sesión.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $usuarioId = $_SESSION['usuario_id'];
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        $fotoUrl = trim($data['foto_url'] ?? '');
        if (!empty($fotoUrl)) {
            $fotoUrl = preg_replace('/=s\d+(-c)?$/i', '=s400', $fotoUrl);
        }

        if (empty($fotoUrl)) {
            http_response_code(400);
            echo json_encode(['error' => 'URL de foto de Google es obligatoria.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $this->usuario->actualizarFotoPerfil($usuarioId, $fotoUrl, 1);
        $userDb = $this->usuario->obtenerPorId($usuarioId);

        echo json_encode([
            'success' => true,
            'message' => '¡Foto de Google sincronizada correctamente!',
            'user' => [
                'id'          => $usuarioId,
                'nombre'      => $userDb['nombre'],
                'correo'      => $userDb['correo'],
                'foto_perfil' => $fotoUrl,
                'es_google'   => 1
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function eliminar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado. Debe iniciar sesión.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $usuarioId = $_SESSION['usuario_id'];

        try {
            $this->usuario->eliminarUsuario($usuarioId);
            session_destroy();
            session_start();
            echo json_encode([
                'success' => true,
                'message' => '¡Su cuenta y todos sus datos han sido eliminados permanentemente del sistema!'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al eliminar la cuenta: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}
