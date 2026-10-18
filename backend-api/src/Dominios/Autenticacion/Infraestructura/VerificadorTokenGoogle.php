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
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode !== 200 || empty($response)) {
            if ($curlError !== '') {
                error_log('[ZeaSys] Error al verificar token de Google: ' . $curlError);
            }
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
        $emailVerificado = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (empty($email)) {
            throw new ValidacionException('No se pudo obtener el correo del token de Google.');
        }

        if (!$emailVerificado) {
            throw new NoAutorizadoException('La cuenta de Google no tiene un correo verificado.');
        }

        if (defined('GOOGLE_CLIENT_ID') && GOOGLE_CLIENT_ID !== '' && $aud !== GOOGLE_CLIENT_ID) {
            throw new NoAutorizadoException('La audiencia del token de Google no coincide con la aplicación registrada.');
        }

        return ['nombre' => $nombre, 'correo' => $email, 'picture' => $picture];
    }
}
