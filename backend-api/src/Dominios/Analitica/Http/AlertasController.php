<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Http;

use ZeaSys\Dominios\Terreno\Infraestructura\AvisosWhatsApp;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class AlertasController
{
    public function __construct(private \PDO $db) {}

    public function preferencia(Peticion $p): void
    {
        $id = $p->queryEntero('parcela_id', null, 1);
        $usuario = (int) $_SESSION['usuario_id'];
        $q = $this->db->prepare('SELECT id FROM parcelas WHERE id = ? AND usuario_id = ? AND activo = 1');
        $q->execute([$id, $usuario]);
        if (!$q->fetchColumn()) throw new AccesoDenegadoException('Parcela no disponible.');
        if ($p->metodo() === 'DELETE') {
            $this->db->prepare('DELETE FROM alertas_lluvia WHERE parcela_id = ? AND usuario_id = ?')->execute([$id, $usuario]);
            RespuestaJson::enviar(['activa' => false]);
            return;
        }
        if (!AvisosWhatsApp::configurado()) { RespuestaJson::enviar(['configurado' => false]); return; }
        if ($p->metodo() === 'POST') {
            $mm = $p->campo('umbral_mm');
            if ($p->campo('consiento') !== true || !is_numeric($mm) || $mm < 1 || $mm > 500 || round((float) $mm, 1) != $mm) {
                throw new ValidacionException('Autoriza los avisos y elige un umbral diario entre 1 y 500 mm con máximo un decimal.');
            }
            $code = strtoupper(bin2hex(random_bytes(16)));
            $this->db->prepare("INSERT INTO alertas_lluvia (parcela_id, usuario_id, umbral_mm, codigo_hash, codigo_vence, aviso_version)
                VALUES (?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL 15 MINUTE, 'lluvia-v1')
                ON DUPLICATE KEY UPDATE umbral_mm = VALUES(umbral_mm), codigo_hash = VALUES(codigo_hash), codigo_vence = VALUES(codigo_vence),
                telefono = NULL, consentido_utc = NULL, aviso_version = VALUES(aviso_version)")->execute([$id, $usuario, $mm, hash('sha256',$code)]);
            RespuestaJson::enviar(['configurado' => true, 'confirmar_url' => 'https://wa.me/' . getenv('ZEASYS_WA_NUMERO') . '?text=' . rawurlencode('ALTA ' . $code)]);
            return;
        }
        $q = $this->db->prepare('SELECT telefono IS NOT NULL AS activa, umbral_mm, consentido_utc, codigo_vence > UTC_TIMESTAMP() AS pendiente FROM alertas_lluvia WHERE parcela_id = ? AND usuario_id = ?');
        $q->execute([$id, $usuario]);
        $registro = $q->fetch() ?: [];
        RespuestaJson::enviar(['configurado' => true, 'activa' => (bool) ($registro['activa'] ?? false), 'pendiente' => (bool) ($registro['pendiente'] ?? false),
            'umbral_mm' => $registro['umbral_mm'] ?? null, 'consentido_utc' => $registro['consentido_utc'] ?? null]);
    }

    public function webhook(Peticion $p): void
    {
        if (!AvisosWhatsApp::configurado()) throw new AccesoDenegadoException('Canal no configurado.');
        if ($p->metodo() === 'GET') {
            if ($p->query('hub_mode') !== 'subscribe' || !hash_equals(getenv('ZEASYS_WA_VERIFY_TOKEN'), (string) $p->query('hub_verify_token'))) {
                throw new AccesoDenegadoException('Verificación inválida.');
            }
            header('Content-Type: text/plain');
            echo (string) $p->query('hub_challenge');
            return;
        }
        $raw = (string) file_get_contents('php://input');
        $firma = 'sha256=' . hash_hmac('sha256', $raw, getenv('ZEASYS_WA_APP_SECRET'));
        if (!hash_equals($firma, (string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? ''))) throw new AccesoDenegadoException('Firma inválida.');
        AvisosWhatsApp::procesarEntrada($this->db, json_decode($raw, true) ?: []);
        RespuestaJson::enviar(['ok' => true]);
    }
}
