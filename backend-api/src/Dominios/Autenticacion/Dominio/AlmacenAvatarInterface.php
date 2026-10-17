<?php
// src/Dominios/Autenticacion/Dominio/AlmacenAvatarInterface.php — Contrato del almacén de fotos de perfil.
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface AlmacenAvatarInterface
{
    /**
     * Valida y guarda una foto de perfil.
     * @param array<string, mixed> $archivo  Entrada de $_FILES (p. ej. $_FILES['foto'])
     * @return string URL pública: /backend-api/public/uploads/avatars/...
     */
    public function guardar(array $archivo, int $usuarioId): string;
}
