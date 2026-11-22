<?php
declare(strict_types=1);

use ZeaSys\Dominios\Terreno\Aplicacion\ServicioClimaActual;
use ZeaSys\Dominios\Terreno\Infraestructura\AvisosWhatsApp;
use ZeaSys\Kernel\AutoloaderPsr4;

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../backend-api/src/Kernel/AutoloaderPsr4.php';
AutoloaderPsr4::registrar(__DIR__ . '/../backend-api/src');
require __DIR__ . '/../backend-api/src/Config/aplicacion.php';

if (!AvisosWhatsApp::configurado()) { echo "WhatsApp sin configuración. Ningún envío.\n"; exit; }
$enviar = ($argv[1] ?? '') === '--enviar';
$contenedor = (require __DIR__ . '/../backend-api/src/Config/contenedor.php')();
$clima = $contenedor->get(ServicioClimaActual::class);
$db = getConnection();
$hoy = new DateTimeImmutable('today', new DateTimeZone('America/Guayaquil'));
$semana = $hoy->modify('monday this week')->format('Y-m-d');
$q = $db->prepare("SELECT a.parcela_id, a.umbral_mm, a.consentido_utc, p.latitud, p.longitud, p.altitud
    FROM alertas_lluvia a JOIN parcelas p ON p.id = a.parcela_id AND p.usuario_id = a.usuario_id
    JOIN usuarios u ON u.id = a.usuario_id LEFT JOIN envios_alertas_lluvia e ON a.parcela_id = e.parcela_id AND e.semana = ?
    WHERE a.telefono IS NOT NULL AND p.activo = 1 AND u.activo = 1 AND p.latitud IS NOT NULL AND p.longitud IS NOT NULL
    AND (e.estado IS NULL OR e.estado='pendiente' OR (e.estado = 'reintentar' AND e.intentos < 3 AND e.actualizado_utc < UTC_TIMESTAMP() - INTERVAL 1 HOUR))");
$q->execute([$semana]);
$coincidencias = 0;
$aceptados = 0;
foreach ($q->fetchAll() as $fila) {
    $pronostico = $clima->obtener((float) $fila['latitud'], (float) $fila['longitud'], isset($fila['altitud']) ? (float) $fila['altitud'] : null);
    $pico = AvisosWhatsApp::lluvia($pronostico, $hoy->format('Y-m-d'), (float) $fila['umbral_mm']);
    if (!$pico) continue;
    $coincidencias++;
    if (!$enviar) continue;
    $id = (int) $fila['parcela_id'];
    // Reserva durable. Si el proceso se pierde después de enviar, otra ejecución no duplica la alerta.
    $db->prepare("INSERT IGNORE INTO envios_alertas_lluvia (parcela_id,semana,estado,actualizado_utc) VALUES (?,?,'pendiente',UTC_TIMESTAMP())")->execute([$id,$semana]);
    $reserva = $db->prepare("UPDATE envios_alertas_lluvia SET estado='despachando', intentos=intentos+1, actualizado_utc=UTC_TIMESTAMP()
        WHERE parcela_id=? AND semana=? AND (estado='pendiente' OR (estado='reintentar' AND intentos<3 AND actualizado_utc < UTC_TIMESTAMP() - INTERVAL 1 HOUR))");
    $reserva->execute([$id,$semana]);
    if (!$reserva->rowCount()) continue;
    $db->beginTransaction();
    try {
        // Serializa la última comprobación con una posible baja o cambio del umbral.
        $actual = $db->prepare('SELECT a.telefono FROM alertas_lluvia a JOIN parcelas p ON p.id=a.parcela_id AND p.usuario_id=a.usuario_id
            JOIN usuarios u ON u.id=a.usuario_id WHERE a.parcela_id=? AND a.consentido_utc=? AND a.umbral_mm=? AND p.activo=1 AND u.activo=1 FOR UPDATE');
        $actual->execute([$id, $fila['consentido_utc'], $fila['umbral_mm']]);
        $telefono = $actual->fetchColumn();
        $estado = $telefono ? AvisosWhatsApp::enviar((string)$telefono, $pico) : 'cancelado';
        $db->prepare('UPDATE envios_alertas_lluvia SET estado=?, actualizado_utc=UTC_TIMESTAMP() WHERE parcela_id=? AND semana=?')->execute([$estado,$id,$semana]);
        $db->commit();
        if ($estado === 'aceptado') $aceptados++;
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}
echo "Coincidencias: $coincidencias. Aceptados por Meta: $aceptados.\n";
