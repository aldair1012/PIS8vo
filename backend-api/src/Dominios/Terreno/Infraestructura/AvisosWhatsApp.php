<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Infraestructura;

final class AvisosWhatsApp
{
    public static function configurado(): bool
    {
        foreach (['TOKEN','PHONE_ID','NUMERO','PLANTILLA','APP_SECRET','VERIFY_TOKEN','VERSION'] as $key) {
            if (!getenv('ZEASYS_WA_' . $key)) return false;
        }
        return preg_match('/^v[0-9]+\\.[0-9]+$/D', getenv('ZEASYS_WA_VERSION')) === 1
            && preg_match('/^[0-9]+$/D', getenv('ZEASYS_WA_PHONE_ID')) === 1
            && preg_match('/^[1-9][0-9]{6,14}$/D', getenv('ZEASYS_WA_NUMERO')) === 1;
    }

    public static function lluvia(array $pronostico, string $hoy, float $umbral): ?array
    {
        if (!($pronostico['disponible'] ?? false) || ($pronostico['estado'] ?? '') === 'ultimo_conocido') return null;
        $fin = (new \DateTimeImmutable($hoy))->modify('+6 days')->format('Y-m-d');
        $pico = null;
        foreach ($pronostico['pronostico_7d'] ?? [] as $dia) {
            $fecha = $dia['fecha'] ?? null;
            $mm = $dia['precipitacion_mm'] ?? null;
            if (!is_string($fecha) || $fecha < $hoy || $fecha > $fin || !is_numeric($mm) || $mm < $umbral) continue;
            if (!$pico || $mm > $pico['mm']) $pico = ['fecha' => $fecha, 'mm' => (float) $mm];
        }
        return $pico;
    }

    public static function procesarEntrada(\PDO $db, array $evento): void
    {
        foreach ($evento['entry'] ?? [] as $entry) foreach ($entry['changes'] ?? [] as $change) {
            $value = $change['value'] ?? [];
            if (($value['metadata']['phone_number_id'] ?? '') !== getenv('ZEASYS_WA_PHONE_ID')) continue;
            foreach ($value['messages'] ?? [] as $msg) {
                $numero = $msg['from'] ?? '';
                $texto = strtoupper(trim((string) ($msg['text']['body'] ?? '')));
                if (!is_string($numero) || !preg_match('/^[1-9][0-9]{6,14}$/D', $numero)) continue;
                if (in_array($texto, ['BAJA', 'STOP'], true)) {
                    $db->prepare('DELETE FROM alertas_lluvia WHERE telefono = ?')->execute([$numero]);
                } elseif (preg_match('/^ALTA ([A-F0-9]{32})$/D', $texto, $match)) {
                    $db->prepare('UPDATE alertas_lluvia SET telefono = ?, consentido_utc = UTC_TIMESTAMP(),
                        codigo_hash = NULL, codigo_vence = NULL WHERE codigo_hash = ? AND codigo_vence > UTC_TIMESTAMP()')
                       ->execute([$numero, hash('sha256', $match[1])]);
                }
            }
        }
    }

    public static function enviar(string $telefono, array $pico): string
    {
        $url = 'https://graph.facebook.com/' . getenv('ZEASYS_WA_VERSION') . '/' . getenv('ZEASYS_WA_PHONE_ID') . '/messages';
        $body = ['messaging_product' => 'whatsapp', 'to' => $telefono, 'type' => 'template',
            'template' => ['name' => getenv('ZEASYS_WA_PLANTILLA'), 'language' => ['code' => getenv('ZEASYS_WA_IDIOMA') ?: 'es'],
                'components' => [['type' => 'body', 'parameters' => [
                    ['type' => 'text', 'text' => $pico['fecha']], ['type' => 'text', 'text' => (string) $pico['mm']],
                ]]]]];
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 9,
            CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . getenv('ZEASYS_WA_TOKEN')],
            CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR)]);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_errno($ch);
        curl_close($ch);
        if ($status >= 200 && $status < 300 && isset(json_decode((string) $response, true)['messages'][0]['id'])) return 'aceptado';
        if ($status === 429 || in_array($error, [CURLE_COULDNT_CONNECT, CURLE_COULDNT_RESOLVE_HOST], true)) return 'reintentar';
        if ($status >= 400 && $status < 500) return 'rechazado';
        return 'indeterminado';
    }
}
