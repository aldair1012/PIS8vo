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

        $tamano = filter_var($archivo['size'] ?? null, FILTER_VALIDATE_INT);
        if ($tamano === false || $tamano <= 0) {
            throw new ValidacionException('El archivo subido está vacío o es inválido.');
        }
        if ($tamano > self::MAX_BYTES) {
            throw new ValidacionException('El archivo supera el tamaño máximo permitido de 5 MB.');
        }

        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false || !is_string($archivo['tmp_name'] ?? null)) {
            throw new ZeaSysException('No se pudo validar la imagen en el servidor.', 500);
        }
        $mimeType = finfo_file($finfo, $archivo['tmp_name']);
        finfo_close($finfo);

        if (!array_key_exists($mimeType, self::MIMES_PERMITIDOS)) {
            throw new ValidacionException('El formato del archivo no es permitido. Suba una imagen JPG, PNG, WEBP o GIF.');
        }
        $ext = self::MIMES_PERMITIDOS[$mimeType];

        $uploadDir = __DIR__ . '/../../../../public/uploads/avatars/';
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                throw new ZeaSysException('No se pudo preparar el directorio de imágenes.', 500);
            }
        }

        $filename = 'avatar_' . $usuarioId . '_' . bin2hex(random_bytes(12)) . '.' . $ext;
        if (!move_uploaded_file($archivo['tmp_name'], $uploadDir . $filename)) {
            throw new ZeaSysException('No se pudo guardar la imagen en el servidor.', 500);
        }

        return '/backend-api/public/uploads/avatars/' . $filename;
    }

    public function eliminar(?string $fotoUrl): void
    {
        if ($fotoUrl === null || !str_starts_with($fotoUrl, '/backend-api/public/uploads/avatars/')) {
            return;
        }

        $filename = basename($fotoUrl);
        if (!preg_match('/^avatar_\d+_(?:\d+|[a-f0-9]{24})\.(?:jpg|png|webp|gif)$/i', $filename)) {
            return;
        }

        $uploadDir = realpath(__DIR__ . '/../../../../public/uploads/avatars/');
        if ($uploadDir === false) {
            return;
        }
        $ruta = realpath($uploadDir . DIRECTORY_SEPARATOR . $filename);
        if ($ruta === false || dirname($ruta) !== $uploadDir) {
            return;
        }
        if (!unlink($ruta)) {
            error_log('[ZeaSys] No se pudo eliminar el avatar local: ' . $filename);
        }
    }
}
