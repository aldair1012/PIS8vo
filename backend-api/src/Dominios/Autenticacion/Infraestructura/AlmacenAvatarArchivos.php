<?php
// src/Dominios/Autenticacion/Infraestructura/AlmacenAvatarArchivos.php — Guarda avatares en public/uploads/avatars.
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Errores\ZeaSysException;

final class AlmacenAvatarArchivos implements AlmacenAvatarInterface
{
    private const MAX_BYTES = 5242880; // 5 MB
    private const MIMES_PERMITIDOS = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    public function guardar(array $archivo, int $usuarioId): string
    {
        if (($archivo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ValidacionException('No se ha seleccionado ningún archivo o ocurrió un error al subirlo.');
        }

        if ($archivo['size'] > self::MAX_BYTES) {
            throw new ValidacionException('El archivo supera el tamaño máximo permitido de 5 MB.');
        }

        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $archivo['tmp_name']);
        finfo_close($finfo);

        if (!array_key_exists($mimeType, self::MIMES_PERMITIDOS)) {
            throw new ValidacionException('El formato del archivo no es permitido. Suba una imagen JPG, PNG, WEBP o GIF.');
        }
        $ext = self::MIMES_PERMITIDOS[$mimeType];

        $uploadDir = __DIR__ . '/../../../../public/uploads/avatars/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = 'avatar_' . $usuarioId . '_' . time() . '.' . $ext;
        if (!move_uploaded_file($archivo['tmp_name'], $uploadDir . $filename)) {
            throw new ZeaSysException('No se pudo guardar la imagen en el servidor.', 500);
        }

        return '/backend-api/public/uploads/avatars/' . $filename;
    }
}
