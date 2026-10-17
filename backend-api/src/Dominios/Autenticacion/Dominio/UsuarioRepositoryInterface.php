<?php
// src/Dominios/Autenticacion/Dominio/UsuarioRepositoryInterface.php — Contrato del repositorio de usuarios.
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface UsuarioRepositoryInterface
{
    /** @return array<string, mixed>|false  (false = credenciales inválidas o inactivo) */
    public function login(string $correo, string $contrasena);

    public function registrar(string $nombre, string $correo, string $contrasena): int;

    public function existeCorreo(string $correo): bool;

    /** @return array<string, mixed>|null */
    public function obtenerPorId(int $id): ?array;

    public function actualizarFotoPerfil(int $id, ?string $fotoUrl, int $esGoogle = 0): bool;

    public function existeCorreoParaOtro(string $correo, int $id): bool;

    public function obtenerPasswordHash(int $id): ?string;

    public function actualizarUsuario(int $id, string $nombre, ?string $contrasenaHash = null): bool;

    public function eliminarUsuario(int $id): bool;

    /** @return array<string, mixed>|false */
    public function buscarOCrearPorGoogle(string $nombre, string $correo, ?string $picture = null);
}
