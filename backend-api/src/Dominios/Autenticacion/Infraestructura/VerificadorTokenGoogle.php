<?php
// src/Dominios/Autenticacion/Infraestructura/VerificadorTokenGoogle.php — Verifica id_token contra Google (tokeninfo).
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class VerificadorTokenGoogle implements VerificadorTokenGoogleInterface
{
    public function verificar(string $idToken): array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($response)) {
            throw new NoAutorizadoException('El token de Google no es válido o ha expirado.');
        }

        $payload = json_decode($response, true);
        $email   = trim($payload['email'] ?? '');
        $nombre  = trim($payload['name'] ?? 'Usuario de Google');
        $picture = trim($payload['picture'] ?? '');
        if (!empty($picture)) {
            $picture = preg_replace('/=s\d+(-c)?$/i', '=s400', $picture);
        }
        $aud = trim($payload['aud'] ?? '');

        if (empty($email)) {
            throw new ValidacionException('No se pudo obtener el correo del token de Google.');
        }

        if (defined('GOOGLE_CLIENT_ID') && GOOGLE_CLIENT_ID !== '' && $aud !== GOOGLE_CLIENT_ID) {
            throw new NoAutorizadoException('La audiencia del token de Google no coincide con la aplicación registrada.');
        }

        return ['nombre' => $nombre, 'correo' => $email, 'picture' => $picture];
    }
}
