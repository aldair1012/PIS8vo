<?php
/**
 * Repositorio: UsuarioRepositoryMysql
 * ===================================
 * Port de models/Usuario.php (e89067d) con los cambios mecánicos del plan F02:
 * namespace, final + interface, PDO inyectada en el constructor (se conserva
 * $this->asegurarColumnasPerfil(); deuda ADR-07) y sin require_once de config.
 */

declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface;

final class UsuarioRepositoryMysql implements UsuarioRepositoryInterface
{
    public function __construct(private \PDO $db)
    {
        $this->asegurarColumnasPerfil();
    }

    private function asegurarColumnasPerfil(): void
    {
        try {
            $this->db->exec("ALTER TABLE usuarios ADD COLUMN foto_perfil VARCHAR(500) DEFAULT NULL");
        } catch (\Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE usuarios ADD COLUMN es_google TINYINT(1) DEFAULT 0");
        } catch (\Exception $e) {}
    }

    public function login(string $correo, string $contrasena)
    {
        $stmt = $this->db->prepare(
            'SELECT id, nombre, correo, contrasena, foto_perfil, es_google, activo
             FROM usuarios WHERE correo = :correo LIMIT 1'
        );
        $stmt->execute(['correo' => $correo]);
        $usuario = $stmt->fetch();

        if ($usuario && $usuario['activo'] && password_verify($contrasena, $usuario['contrasena'])) {
            $this->actualizarUltimoAcceso($usuario['id']);
            unset($usuario['contrasena']);
            return $usuario;
        }

        return false;
    }

    public function registrar(string $nombre, string $correo, string $contrasena): int
    {
        $hash = password_hash($contrasena, PASSWORD_BCRYPT);

        $stmt = $this->db->prepare(
            'INSERT INTO usuarios (nombre, correo, contrasena, es_google)
             VALUES (:nombre, :correo, :contrasena, 0)'
        );
        $stmt->execute([
            'nombre'     => $nombre,
            'correo'     => $correo,
            'contrasena' => $hash
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function existeCorreo(string $correo): bool
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM usuarios WHERE correo = :correo'
        );
        $stmt->execute(['correo' => $correo]);
        return $stmt->fetchColumn() > 0;
    }

    public function obtenerPorId(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, nombre, correo, foto_perfil, es_google, fecha_registro, ultimo_acceso, activo
             FROM usuarios WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    private function actualizarUltimoAcceso(int $id): void
    {
        $stmt = $this->db->prepare(
            'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
    }

    public function actualizarFotoPerfil(int $id, ?string $fotoUrl, int $esGoogle = 0): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE usuarios SET foto_perfil = :foto_perfil, es_google = :es_google WHERE id = :id'
        );
        return $stmt->execute([
            'foto_perfil' => $fotoUrl,
            'es_google'   => $esGoogle,
            'id'          => $id
        ]);
    }

    public function existeCorreoParaOtro(string $correo, int $id): bool
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM usuarios WHERE correo = :correo AND id != :id'
        );
        $stmt->execute(['correo' => $correo, 'id' => $id]);
        return $stmt->fetchColumn() > 0;
    }

    public function obtenerPasswordHash(int $id): ?string
    {
        $stmt = $this->db->prepare('SELECT contrasena FROM usuarios WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetchColumn() ?: null;
    }

    public function actualizarUsuario(int $id, string $nombre, ?string $contrasenaHash = null): bool
    {
        if ($contrasenaHash) {
            $stmt = $this->db->prepare(
                'UPDATE usuarios SET nombre = :nombre, contrasena = :contrasena WHERE id = :id'
            );
            return $stmt->execute([
                'nombre' => $nombre,
                'contrasena' => $contrasenaHash,
                'id' => $id
            ]);
        } else {
            $stmt = $this->db->prepare(
                'UPDATE usuarios SET nombre = :nombre WHERE id = :id'
            );
            return $stmt->execute([
                'nombre' => $nombre,
                'id' => $id
            ]);
        }
    }

    public function eliminarUsuario(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM usuarios WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    public function buscarOCrearPorGoogle(string $nombre, string $correo, ?string $picture = null)
    {
        $stmt = $this->db->prepare(
            'SELECT id, nombre, correo, foto_perfil, es_google, activo
             FROM usuarios WHERE correo = :correo LIMIT 1'
        );
        $stmt->execute(['correo' => $correo]);
        $usuario = $stmt->fetch();

        if ($usuario) {
            if (!$usuario['activo']) {
                return false;
            }
            // Si viene foto de Google y es diferente, o si es_google era 0, actualizarla
            if (!empty($picture)) {
                $stmtUpdate = $this->db->prepare(
                    'UPDATE usuarios SET foto_perfil = :picture, es_google = 1 WHERE id = :id'
                );
                $stmtUpdate->execute(['picture' => $picture, 'id' => $usuario['id']]);
                $usuario['foto_perfil'] = $picture;
            }
            $usuario['es_google'] = 1;
            $this->actualizarUltimoAcceso($usuario['id']);
            return $usuario;
        }

        // Crear un nuevo usuario con contraseña aleatoria segura
        $contrasenaAleatoria = bin2hex(random_bytes(16));
        $hash = password_hash($contrasenaAleatoria, PASSWORD_BCRYPT);

        $stmtInsert = $this->db->prepare(
            'INSERT INTO usuarios (nombre, correo, contrasena, foto_perfil, es_google, rol, activo)
             VALUES (:nombre, :correo, :contrasena, :foto_perfil, 1, \'agricultor\', 1)'
        );
        $stmtInsert->execute([
            'nombre'      => $nombre,
            'correo'      => $correo,
            'contrasena'  => $hash,
            'foto_perfil' => $picture
        ]);

        $id = (int) $this->db->lastInsertId();
        $this->actualizarUltimoAcceso($id);

        return [
            'id'          => $id,
            'nombre'      => $nombre,
            'correo'      => $correo,
            'foto_perfil' => $picture,
            'es_google'   => 1,
            'activo'      => 1
        ];
    }
}
